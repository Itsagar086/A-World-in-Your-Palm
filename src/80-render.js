/* =============================================================================
 * A World in Your Palm — 80-render.js
 * Renderer, lighting, the day/night cycle, and the post chain.
 *
 * The sun is a directional light that orbits the planet, so there is a real
 * terminator you can walk across: half the globe is genuinely in night at any
 * moment, with a dim blue "moon" fill on the far side so the dark half stays
 * navigable. Everything that reacts to darkness — stars, the explorer's
 * lantern, the atmosphere rim — is driven by the sun's dot product with the
 * explorer's own surface normal, so it is local time, not global time.
 *
 * Post-processing is hand-rolled: scene to an HDR target, a small separable
 * bloom, then one composite pass doing tone mapping, vignette and sRGB. That
 * avoids pulling in any addon, and the bloom is what makes the night side and
 * the glowing biomes worth visiting.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = global.TW;
  var clamp = T.MathUtils.clamp;
  var lerp = T.MathUtils.lerp;

  /* --- shared shader chunks -------------------------------------------------- */

  var FULLSCREEN_VERT = [
    'varying vec2 vUv;',
    'void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  ].join('\n');

  /* Khronos PBR Neutral — the same curve three.js ships as NeutralToneMapping,
   * inlined so this works on any build. It keeps saturated colours from
   * shifting hue as they clip, which matters a lot for a world this colourful. */
  var TONEMAP_GLSL = [
    'vec3 neutralToneMap(vec3 color){',
    '  const float startCompression = 0.76;',
    '  const float desaturation = 0.15;',
    '  float x = min(color.r, min(color.g, color.b));',
    '  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;',
    '  color -= offset;',
    '  float peak = max(color.r, max(color.g, color.b));',
    '  if (peak < startCompression) return color;',
    '  float d = 1.0 - startCompression;',
    '  float newPeak = 1.0 - d * d / (peak + d - startCompression);',
    '  color *= newPeak / peak;',
    '  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);',
    '  return mix(color, vec3(newPeak), g);',
    '}',
  ].join('\n');

  var SRGB_GLSL = [
    'vec3 toSRGB(vec3 c){',
    '  return mix(pow(max(c, vec3(0.0)), vec3(0.41666)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308)));',
    '}',
  ].join('\n');

  /* --- explorer occlusion ----------------------------------------------------- */

  /* When the camera is close behind the explorer, anything between the two is
   * dithered away with a fixed 4x4 Bayer pattern. A fixed pattern (rather than
   * a noise field) is important: it does not sparkle when nothing is moving. */
  var OCCLUSION_KEY = 'tiny-world-occlusion-bayer4-v1';

  var OCCLUSION_VERT_HEAD = 'varying vec3 vOccWorld;';
  var OCCLUSION_VERT_BODY =
    'vOccWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;';

  var OCCLUSION_FRAG_HEAD = [
    'uniform vec3 uOccTarget;',
    'uniform float uOccEnabled;',
    'varying vec3 vOccWorld;',
    'float occBayer(vec2 fragmentPosition){',
    '  vec2 cell = mod(floor(fragmentPosition), 4.0);',
    '  vec2 low = mod(cell, 2.0);',
    '  vec2 high = floor(cell * 0.5);',
    '  float lowRank = 2.0 * low.x + 3.0 * low.y - 4.0 * low.x * low.y;',
    '  float highRank = 2.0 * high.x + 3.0 * high.y - 4.0 * high.x * high.y;',
    '  return (4.0 * lowRank + highRank) / 16.0;',
    '}',
  ].join('\n');

  var OCCLUSION_FRAG_BODY = [
    'if (uOccEnabled > 0.5) {',
    '  vec3 toTarget = uOccTarget - cameraPosition;',
    '  float targetDistance = length(toTarget);',
    '  if (targetDistance > 0.001) {',
    '    vec3 viewDir = toTarget / targetDistance;',
    '    vec3 toFragment = vOccWorld - cameraPosition;',
    '    float along = dot(toFragment, viewDir);',
    '    if (along > 0.05 && along < targetDistance - 0.25) {',
    '      float offAxis = length(toFragment - viewDir * along);',
    '      float fade = 1.0 - smoothstep(0.55, 1.5, offAxis);',
    '      fade *= smoothstep(0.0, 0.7, targetDistance - along);',
    '      if (fade > 0.02 && occBayer(gl_FragCoord.xy) < fade) discard;',
    '    }',
    '  }',
    '}',
  ].join('\n');

  /**
   * Patch every opaque standard material under `root` so props can dither out
   * of the way. Returns a handle that can restore the originals.
   */
  function installOcclusion(root, targetUniform, enabledUniform) {
    var replacements = new Map();
    var swapped = [];

    function patch(material) {
      if (!material || !material.isMeshStandardMaterial || material.transparent) return material;
      if (replacements.has(material)) return replacements.get(material);

      var clone = material.clone();
      var originalHook = material.onBeforeCompile;
      var originalKey = material.customProgramCacheKey;

      clone.onBeforeCompile = function (shader, renderer) {
        originalHook.call(this, shader, renderer);
        shader.uniforms.uOccTarget = targetUniform;
        shader.uniforms.uOccEnabled = enabledUniform;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + OCCLUSION_VERT_HEAD)
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + OCCLUSION_VERT_BODY);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + OCCLUSION_FRAG_HEAD)
          .replace('#include <clipping_planes_fragment>',
            '#include <clipping_planes_fragment>\n' + OCCLUSION_FRAG_BODY);
      };
      clone.customProgramCacheKey = function () {
        return originalKey.call(material) + '|' + OCCLUSION_KEY;
      };
      clone.needsUpdate = true;
      replacements.set(material, clone);
      return clone;
    }

    root.traverse(function (node) {
      if (!node.isMesh || node.isInstancedMesh) return;
      var current = node.material;
      var next = Array.isArray(current) ? current.map(patch) : patch(current);
      var changed = Array.isArray(current)
        ? next.some(function (m, i) { return m !== current[i]; })
        : next !== current;
      if (changed) {
        node.material = next;
        swapped.push({ node: node, original: current, installed: next });
      }
    });

    return {
      count: swapped.length,
      dispose: function () {
        for (var i = 0; i < swapped.length; i++) {
          if (swapped[i].node.material === swapped[i].installed) swapped[i].node.material = swapped[i].original;
        }
        replacements.forEach(function (m) { m.dispose(); });
        replacements.clear();
      },
    };
  }

  /* --- post chain -------------------------------------------------------------- */

  function createPost(renderer, scene, camera) {
    var quadGeo = new T.BufferGeometry();
    quadGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    quadGeo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    var quadCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var quadScene = new T.Scene();
    var quadMesh = new T.Mesh(quadGeo, null);
    quadMesh.frustumCulled = false;
    quadScene.add(quadMesh);

    function blit(material, target) {
      quadMesh.material = material;
      renderer.setRenderTarget(target || null);
      renderer.clear(true, true, false);
      renderer.render(quadScene, quadCamera);
    }

    var rtOptions = {
      type: T.HalfFloatType,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    };
    var sceneTarget = new T.WebGLRenderTarget(1, 1, Object.assign({ samples: 4 }, rtOptions));
    var bloomA = new T.WebGLRenderTarget(1, 1, Object.assign({ depthBuffer: false }, rtOptions));
    var bloomB = new T.WebGLRenderTarget(1, 1, Object.assign({ depthBuffer: false }, rtOptions));

    var brightMaterial = new T.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: 0.82 },
        knee: { value: 0.45 },
      },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform float threshold;',
        'uniform float knee;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
        '  float brightness = max(c.r, max(c.g, c.b));',
        '  float soft = clamp((brightness - threshold + knee) / (2.0 * knee), 0.0, 1.0);',
        '  float weight = max(brightness - threshold, soft * soft * knee) / max(brightness, 0.0001);',
        '  gl_FragColor = vec4(c * weight, 1.0);',
        '}',
      ].join('\n'),
      depthTest: false,
      depthWrite: false,
    });

    /* A 9-tap Gaussian, run separably and twice at growing radius. */
    var blurMaterial = new T.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        direction: { value: new T.Vector2(1, 0) },
        texel: { value: new T.Vector2(1 / 512, 1 / 512) },
      },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform vec2 direction;',
        'uniform vec2 texel;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec2 step = direction * texel;',
        '  vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.227027;',
        '  sum += texture2D(tDiffuse, vUv + step * 1.3846).rgb * 0.316216;',
        '  sum += texture2D(tDiffuse, vUv - step * 1.3846).rgb * 0.316216;',
        '  sum += texture2D(tDiffuse, vUv + step * 3.2308).rgb * 0.070270;',
        '  sum += texture2D(tDiffuse, vUv - step * 3.2308).rgb * 0.070270;',
        '  gl_FragColor = vec4(sum, 1.0);',
        '}',
      ].join('\n'),
      depthTest: false,
      depthWrite: false,
    });

    var compositeMaterial = new T.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        bloomStrength: { value: 0.55 },
        exposure: { value: 1.1 },
        vignette: { value: 0.34 },
        nightTint: { value: new T.Color('#8fb6d8') },
        nightAmount: { value: 0 },
      },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: [
        'uniform sampler2D tScene;',
        'uniform sampler2D tBloom;',
        'uniform float bloomStrength;',
        'uniform float exposure;',
        'uniform float vignette;',
        'uniform vec3 nightTint;',
        'uniform float nightAmount;',
        'varying vec2 vUv;',
        TONEMAP_GLSL,
        SRGB_GLSL,
        'void main(){',
        '  vec4 src = texture2D(tScene, vUv);',
        '  vec3 glow = texture2D(tBloom, vUv).rgb * bloomStrength;',
        '  vec3 color = (src.rgb + glow) * exposure;',
        /* At night, pull a little saturation out and lean the residue blue —
         * the classic "day for night" trick, and it reads as moonlight. */
        '  if (nightAmount > 0.001) {',
        '    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));',
        '    color = mix(color, mix(vec3(luma), color, 0.8) * nightTint, nightAmount * 0.42);',
        '  }',
        '  color = neutralToneMap(color);',
        '  vec2 centred = vUv - 0.5;',
        '  float falloff = 1.0 - vignette * dot(centred, centred) * 2.6;',
        '  color *= clamp(falloff, 0.0, 1.0);',
        /* Carry the scene's own coverage through, so the page background shows
         * around the planet instead of a flat black rectangle. The canvas is
         * premultiplied, hence the multiply on the way out. */
        '  float coverage = clamp(src.a + dot(glow, vec3(0.3333)), 0.0, 1.0);',
        '  gl_FragColor = vec4(toSRGB(color) * coverage, coverage);',
        '}',
      ].join('\n'),
      depthTest: false,
      depthWrite: false,
    });

    var enabled = true;
    var bloomEnabled = true;
    var width = 1;
    var height = 1;
    var pixelRatio = 1;

    /* A 1x1 black texture stands in for the bloom buffer when bloom is off, so
     * the composite shader needs no variant. */
    var blackTexture = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blackTexture.needsUpdate = true;

    function setSize(w, h, ratio) {
      width = Math.max(1, Math.floor(w * ratio));
      height = Math.max(1, Math.floor(h * ratio));
      pixelRatio = ratio;
      sceneTarget.setSize(width, height);
      var bw = Math.max(1, width >> 1);
      var bh = Math.max(1, height >> 1);
      bloomA.setSize(bw, bh);
      bloomB.setSize(bw, bh);
      blurMaterial.uniforms.texel.value.set(1 / bw, 1 / bh);
    }

    function render() {
      if (!enabled) {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        return;
      }
      var previousToneMapping = renderer.toneMapping;
      renderer.toneMapping = T.NoToneMapping;
      renderer.setRenderTarget(sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.toneMapping = previousToneMapping;

      var bloomTexture = blackTexture;
      if (bloomEnabled) {
        brightMaterial.uniforms.tDiffuse.value = sceneTarget.texture;
        blit(brightMaterial, bloomA);

        var passes = [
          [1, 0, 1], [0, 1, 1],
          [1, 0, 2.4], [0, 1, 2.4],
        ];
        var from = bloomA;
        var to = bloomB;
        for (var i = 0; i < passes.length; i++) {
          blurMaterial.uniforms.tDiffuse.value = from.texture;
          blurMaterial.uniforms.direction.value.set(passes[i][0] * passes[i][2], passes[i][1] * passes[i][2]);
          blit(blurMaterial, to);
          var swap = from; from = to; to = swap;
        }
        bloomTexture = from.texture;
      }

      compositeMaterial.uniforms.tScene.value = sceneTarget.texture;
      compositeMaterial.uniforms.tBloom.value = bloomTexture;
      blit(compositeMaterial, null);
    }

    return {
      render: render,
      setSize: setSize,
      composite: compositeMaterial,
      get enabled() { return enabled; },
      set enabled(v) { enabled = !!v; },
      get bloomEnabled() { return bloomEnabled; },
      set bloomEnabled(v) { bloomEnabled = !!v; },
      dispose: function () {
        sceneTarget.dispose();
        bloomA.dispose();
        bloomB.dispose();
        blackTexture.dispose();
        brightMaterial.dispose();
        blurMaterial.dispose();
        compositeMaterial.dispose();
        quadGeo.dispose();
      },
    };
  }

  /* --- sky bodies --------------------------------------------------------------- */

  /* A disc with a radial alpha falloff. `core` is where the solid centre ends,
   * as a fraction of the radius: 0.8 gives a crisp body, 0 gives pure glow.
   * A hard-edged circle would read as a sticker pasted onto the sky. */
  function glowDisc(radius, color, core, strength, segments) {
    var material = new T.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      blending: T.AdditiveBlending,
      uniforms: {
        color: { value: new T.Color(color) },
        core: { value: core },
        strength: { value: strength },
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 color;',
        'uniform float core;',
        'uniform float strength;',
        'varying vec2 vUv;',
        'void main(){',
        '  float d = length(vUv - 0.5) * 2.0;',
        '  float a = 1.0 - smoothstep(core, 1.0, d);',
        '  gl_FragColor = vec4(color, a * strength);',
        '}',
      ].join('\n'),
    });
    var mesh = new T.Mesh(new T.CircleGeometry(radius, segments || 32), material);
    mesh.frustumCulled = false;
    return mesh;
  }

  function createSunAndMoon(scene) {
    var sun = glowDisc(3.2, '#fff3cf', 0.76, 0.95);
    sun.renderOrder = 2;
    scene.add(sun);
    var halo = glowDisc(11, '#ffd98e', 0.0, 0.13);
    halo.renderOrder = 1;
    scene.add(halo);

    var moon = glowDisc(1.7, '#dbe7f4', 0.82, 0.85, 28);
    moon.renderOrder = 2;
    scene.add(moon);
    var moonHalo = glowDisc(5.2, '#a9c6e8', 0.0, 0.1, 24);
    moonHalo.renderOrder = 1;
    scene.add(moonHalo);

    return {
      sun: sun, sunMaterial: sun.material,
      halo: halo, haloMaterial: halo.material,
      moon: moon, moonMaterial: moon.material, moonHalo: moonHalo,
      /** Park both bodies far out along their directions, facing the camera. */
      update: function (sunDir, camera) {
        sun.position.copy(sunDir).multiplyScalar(62);
        halo.position.copy(sunDir).multiplyScalar(62.5);
        moon.position.copy(sunDir).multiplyScalar(-62);
        moonHalo.position.copy(sunDir).multiplyScalar(-62.5);
        sun.lookAt(camera.position);
        halo.lookAt(camera.position);
        moon.lookAt(camera.position);
        moonHalo.lookAt(camera.position);
      },
    };
  }

  /* --- the lighting rig ----------------------------------------------------------- */

  /** How long one full day takes, in seconds. */
  var DAY_LENGTH = 420;

  /* The held phases are expressed as a target sun elevation *at the explorer* —
   * `dot(surfaceNormal, sunDirection)` — not as a fixed clock time. Holding
   * "night" has to mean "it is night where I am standing", and on a planet you
   * can walk all the way around, those are very different things. */
  var PHASES = {
    auto: null,
    day: 0.82,
    dusk: 0.02,
    night: -0.55,
  };

  function createLighting(scene) {
    var ambient = new T.AmbientLight('#cce8dc', 0.5);
    scene.add(ambient);

    var hemi = new T.HemisphereLight('#e7f2e0', '#7a9f91', 0.95);
    scene.add(hemi);

    var sun = new T.DirectionalLight('#fff1d0', 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 130;
    sun.shadow.normalBias = 0.13;
    sun.shadow.bias = -0.0003;
    sun.shadow.radius = 4;
    scene.add(sun);
    scene.add(sun.target);

    /* The moon: a dim, cool fill from exactly the other side, so the night
     * hemisphere is legible without ever looking like daylight. */
    var moon = new T.DirectionalLight('#9fc4e8', 0.62);
    scene.add(moon);
    scene.add(moon.target);

    /* A soft bounce so shadowed slopes do not go flat black. */
    var bounce = new T.DirectionalLight('#cde7d6', 0.4);
    bounce.position.set(-20, -17, -15);
    scene.add(bounce);

    /* The sun runs on a clean tilted great circle: sunDir(t) = A cos t + B sin t
     * with A and B orthonormal. Keeping it analytic means we can *solve* for the
     * time that produces a given elevation at a given point, which is what makes
     * the held phases work anywhere on the globe. */
    var ORBIT_POLE = new T.Vector3(0.34, 1, -0.1).normalize();
    var ORBIT_A = new T.Vector3().crossVectors(ORBIT_POLE, new T.Vector3(0, 0, 1)).normalize();
    var ORBIT_B = new T.Vector3().crossVectors(ORBIT_POLE, ORBIT_A).normalize();

    var sunDir = new T.Vector3();
    var scratchColor = new T.Color();

    var state = {
      timeOfDay: 0.2,    /* 0..1 around the orbit */
      phase: 'auto',
      running: true,
      sunDir: sunDir,
      /** local daylight at the explorer, 0 = deep night, 1 = full day */
      daylight: 1,
    };

    var DAY_AMBIENT = 0.5, NIGHT_AMBIENT = 0.33;
    var DAY_HEMI = 0.95, NIGHT_HEMI = 0.52;

    function sunAt(t, out) {
      var angle = t * Math.PI * 2;
      return out.copy(ORBIT_A).multiplyScalar(Math.cos(angle))
        .addScaledVector(ORBIT_B, Math.sin(angle)).normalize();
    }

    /**
     * The orbit position whose sun elevation at `normal` is closest to `target`.
     * dot(n, sunDir(t)) = R·cos(2πt − φ), so this is one acos — and when the
     * requested elevation is out of reach at this latitude we take the nearest
     * extreme instead of failing.
     */
    function solveTimeFor(normal, target) {
      var a = normal.dot(ORBIT_A);
      var b = normal.dot(ORBIT_B);
      var reach = Math.hypot(a, b);
      var phi = Math.atan2(b, a);
      if (reach < 1e-4) return state.timeOfDay;
      var ratio = clamp(target / reach, -1, 1);
      /* Two solutions; pick the one on the "settling" side so dusk always reads
       * as evening rather than dawn. */
      var t = (phi + Math.acos(ratio)) / (Math.PI * 2);
      return ((t % 1) + 1) % 1;
    }

    /**
     * @param {number} dt
     * @param {THREE.Vector3} focusNormal  where the explorer is standing
     */
    function update(dt, focusNormal) {
      if (state.phase === 'auto') {
        if (state.running) state.timeOfDay = (state.timeOfDay + dt / DAY_LENGTH) % 1;
      } else if (focusNormal) {
        /* Chase the solved time rather than snapping, so walking under a held
         * sky glides instead of strobing. */
        var wanted = solveTimeFor(focusNormal, PHASES[state.phase]);
        var delta = wanted - state.timeOfDay;
        if (delta > 0.5) delta -= 1;
        if (delta < -0.5) delta += 1;
        state.timeOfDay = ((state.timeOfDay + delta * Math.min(1, dt * 9) + 1) % 1);
      }

      sunAt(state.timeOfDay, sunDir);
      sun.position.copy(sunDir).multiplyScalar(58);
      sun.target.position.set(0, 0, 0);
      moon.position.copy(sunDir).multiplyScalar(-58);
      moon.target.position.set(0, 0, 0);

      /* Local daylight, with a soft terminator a few degrees wide. */
      var facing = focusNormal ? focusNormal.dot(sunDir) : 1;
      var daylight = clamp(facing * 2.6 + 0.42, 0, 1);
      state.daylight = daylight;

      /* Warm the key light as it drops toward the horizon. */
      var lowSun = 1 - clamp(Math.abs(facing) * 1.8, 0, 1);
      sun.color.setHex(0xfff1d0).lerp(scratchColor.set('#ffb877'), lowSun * 0.7);
      sun.intensity = 3.2;

      ambient.intensity = lerp(NIGHT_AMBIENT, DAY_AMBIENT, daylight);
      ambient.color.set('#cce8dc').lerp(scratchColor.set('#7f9ec4'), 1 - daylight);
      hemi.intensity = lerp(NIGHT_HEMI, DAY_HEMI, daylight);
      hemi.color.set('#e7f2e0').lerp(scratchColor.set('#8aa8c6'), 1 - daylight);
      hemi.groundColor.set('#7a9f91').lerp(scratchColor.set('#3d5163'), 1 - daylight);
      bounce.intensity = lerp(0.2, 0.4, daylight);
      moon.intensity = lerp(1.15, 0.1, daylight);

      return state;
    }

    function setPhase(phase) {
      state.phase = PHASES[phase] === undefined ? 'auto' : phase;
      return state.phase;
    }

    /** Start the clock so that a given spot is in the light we want it to be.
     *  Without this the game can open on the night side of its own planet. */
    function startAt(normal, elevation) {
      state.timeOfDay = solveTimeFor(normal, elevation === undefined ? 0.62 : elevation);
      sunAt(state.timeOfDay, sunDir);
      return state.timeOfDay;
    }

    return {
      ambient: ambient, hemi: hemi, sun: sun, moon: moon, bounce: bounce,
      state: state, update: update, setPhase: setPhase, startAt: startAt,
      solveTimeFor: solveTimeFor,
      PHASES: PHASES, DAY_LENGTH: DAY_LENGTH,
    };
  }

  TW.render = {
    createPost: createPost,
    createLighting: createLighting,
    createSunAndMoon: createSunAndMoon,
    installOcclusion: installOcclusion,
    DAY_LENGTH: DAY_LENGTH,
    PHASE_ORDER: ['auto', 'day', 'dusk', 'night'],
  };
})(typeof window !== 'undefined' ? window : this);
