/* =============================================================================
 * A World in Your Palm — 10-nature.js
 * The living scenery: trees, bushes, flowers, grass, rocks, crystals, corals
 * and the small animals that wander the biomes. Every one is a pure function
 * of (parent, position, params) so the biome files read like a planting list.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = global.TW;
  var C = TW.core;
  var group = C.group, pivot = C.pivot, mesh = C.mesh, box = C.box, rock = C.rock;
  var cone = C.cone, tube = C.tube, torus = C.torus, sphere = C.sphere;
  var link = C.link, beam = C.beam, poly = C.poly, ribbon = C.ribbon;
  var mat = C.mat, dyn = C.dyn, bake = C.bake, rand = C.rand, TAU = C.TAU;

  var N = {};

  /* --- trees --------------------------------------------------------------- */

  /** Layered conifer. The staple of Cubbon Woods and the cold biomes. */
  N.pine = function (parent, x, z, height, color, rotY) {
    height = height === undefined ? 1.5 : height;
    color = color || '#2c8055';
    var g = group(parent, x, 0.06, z, 1, rotY === undefined ? rand(0, TAU) : rotY);
    g.userData.height = height;
    tube(g, 0, height * 0.21, 0, height * 0.045, height * 0.42, '#7d5238', 5);
    var c = new T.Color(color);
    cone(g, 0, height * 0.42, 0, height * 0.31, height * 0.57, c.clone().multiplyScalar(0.8), 5);
    cone(g, 0, height * 0.66, 0, height * 0.255, height * 0.55, c, 5);
    cone(g, 0, height * 0.87, 0, height * 0.17, height * 0.45, c.clone().multiplyScalar(1.12), 5);
    return g;
  };

  /** Round broadleaf with a forked trunk and three canopy blobs. */
  N.broadleaf = function (parent, x, z, height, color, trunkColor) {
    height = height === undefined ? 1.7 : height;
    color = color || '#57a05a';
    trunkColor = trunkColor || '#8a6242';
    var g = group(parent, x, 0.05, z, 1, rand(0, TAU));
    g.userData.height = height;
    var h = height * 0.44;
    tube(g, 0, h * 0.5, 0, height * 0.05, h, trunkColor, 6);
    link(g, [0, h * 0.86, 0], [height * 0.14, h * 1.2, height * 0.05], height * 0.026, trunkColor, 5);
    link(g, [0, h * 0.86, 0], [-height * 0.12, h * 1.18, -height * 0.07], height * 0.024, trunkColor, 5);
    var c = new T.Color(color);
    rock(g, 0, height * 0.74, 0, height * 0.33, height * 0.29, height * 0.32, c);
    rock(g, height * 0.19, height * 0.62, height * 0.06, height * 0.21, height * 0.19, height * 0.2,
      c.clone().multiplyScalar(1.1));
    rock(g, -height * 0.16, height * 0.63, -height * 0.1, height * 0.19, height * 0.17, height * 0.19,
      c.clone().multiplyScalar(0.85));
    return g;
  };

  /** Slim birch-like tree with painted bark bands. */
  N.birch = function (parent, x, z, height, leafColor) {
    height = height === undefined ? 2.1 : height;
    var g = group(parent, x, 0.05, z, 1, rand(0, TAU));
    g.userData.height = height;
    var trunk = cone(g, 0, height * 0.42, 0, height * 0.035, height * 0.84, '#e6e2d4', 6, height * 0.026);
    trunk.rotation.z = rand(-0.05, 0.05);
    for (var i = 0; i < 5; i++) {
      box(g, 0, height * (0.16 + i * 0.15), height * 0.03,
        height * 0.062, height * 0.018, height * 0.02, '#4b4740');
    }
    var c = new T.Color(leafColor || '#8fc25f');
    rock(g, 0, height * 0.95, 0, height * 0.24, height * 0.2, height * 0.23, c);
    rock(g, height * 0.15, height * 0.83, -height * 0.05, height * 0.15, height * 0.13, height * 0.15,
      c.clone().multiplyScalar(0.88));
    return g;
  };

  /** Fan palm for the coast. Fronds are hand-built six-triangle sheets. */
  N.palm = function (parent, x, z, height, rotY) {
    height = height === undefined ? 1.7 : height;
    var g = group(parent, x, 0.05, z, 1, rotY || 0);
    g.userData.height = height;
    var lean = 0.23;
    for (var i = 0; i < 6; i++) {
      var a = i / 6, b = (i + 1) / 6;
      link(g,
        [lean * a * a, height * a, 0],
        [lean * b * b, height * b, 0],
        0.07 * (1 - a * 0.48), i % 2 ? '#a47646' : '#b98c54', 6, 0.07 * (1 - b * 0.48));
    }
    for (var f = 0; f < 7; f++) {
      var ang = (f * TAU) / 7;
      var reach = rand(0.72, 0.96);
      var w = 0.145;
      var dir = new T.Vector3(Math.cos(ang), 0, Math.sin(ang));
      var side = new T.Vector3(-dir.z, 0, dir.x);
      var pts = [
        [0, 0, 0], [0.31, 0.16, -w], [0.63, 0.04, -w * 0.65],
        [1, -0.22, 0], [0.63, 0.04, w * 0.65], [0.31, 0.16, w], [0.4, 0.2, 0],
      ].map(function (p) {
        return [
          lean + dir.x * p[0] * reach + side.x * p[2],
          height + p[1],
          dir.z * p[0] * reach + side.z * p[2],
        ];
      });
      mesh(g, poly(pts, [[0, 1, 6], [1, 2, 6], [2, 3, 6], [3, 4, 6], [4, 5, 6], [5, 0, 6]]),
        mat(f % 3 === 0 ? '#69a445' : f % 2 ? '#23784f' : '#329259', { side: T.DoubleSide }));
    }
    for (var n = 0; n < 3; n++) {
      rock(g, lean + Math.cos(n * 2.1) * 0.08, height - 0.05, Math.sin(n * 2.1) * 0.09,
        0.078, 0.08, 0.073, '#85603a');
    }
    return g;
  };

  /** Bare, wind-bent tree for the volcano and tundra edges. */
  N.snag = function (parent, x, z, height, color) {
    height = height === undefined ? 1.4 : height;
    color = color || '#6a5a4e';
    var g = group(parent, x, 0.04, z, 1, rand(0, TAU));
    var top = [rand(-0.1, 0.1) * height, height, rand(-0.1, 0.1) * height];
    link(g, [0, 0, 0], top, height * 0.055, color, 5, height * 0.03);
    for (var i = 0; i < 4; i++) {
      var a = (i * TAU) / 4 + rand(-0.3, 0.3);
      var base = [top[0] * 0.6, height * (0.5 + i * 0.11), top[2] * 0.6];
      link(g, base,
        [base[0] + Math.cos(a) * height * 0.36, base[1] + height * 0.2, base[2] + Math.sin(a) * height * 0.36],
        height * 0.022, color, 4, height * 0.008);
    }
    return g;
  };

  /** Glowing cap mushroom. Optionally emissive for the night biome. */
  N.mushroom = function (parent, x, z, scale, capColor, glow) {
    scale = scale === undefined ? 1 : scale;
    capColor = capColor || '#d8617a';
    var g = group(parent, x, 0, z, scale, rand(0, TAU));
    cone(g, 0, 0.17, 0, 0.055, 0.34, '#f0e4cd', 7, 0.042);
    var capMat = glow
      ? mat(capColor, { emissive: capColor, emissiveIntensity: 0.85, roughness: 0.5 })
      : capColor;
    var cap = mesh(g, new T.SphereGeometry(0.2, 9, 5, 0, TAU, 0, Math.PI / 2), capMat, 0, 0.32, 0);
    cap.scale.set(1, 0.72, 1);
    for (var i = 0; i < 5; i++) {
      var a = rand(0, TAU), r = rand(0.05, 0.15);
      mesh(g, new T.IcosahedronGeometry(rand(0.016, 0.03), 0),
        glow ? mat('#fff6d8', { emissive: '#fff0bb', emissiveIntensity: 1.1 }) : '#fbf1dc',
        Math.cos(a) * r, 0.335 + rand(0, 0.02), Math.sin(a) * r);
    }
    return g;
  };

  /* --- ground cover -------------------------------------------------------- */

  /** Three crossed grass blades. Cheapest possible "this ground is alive". */
  N.grass = function (parent, x, z, color, scale, rotY) {
    color = color || '#82b666';
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, 0.06, z, scale, rotY === undefined ? rand(0, TAU) : rotY);
    var verts = [];
    for (var i = 0; i < 3; i++) {
      var a = i * 2.399;
      var cx = Math.cos(a) * 0.07, cz = Math.sin(a) * 0.07;
      verts.push([cx - 0.028, 0, cz], [cx + 0.07, 0.17 + rand(0, 0.12), cz + 0.04], [cx + 0.028, 0, cz]);
    }
    mesh(g, poly(verts), mat(color, { side: T.DoubleSide }));
    return g;
  };

  /** A little flower: stem, petals and a centre. */
  N.flower = function (parent, x, z, petalColor, scale, rotY) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, 0.05, z, scale, rotY === undefined ? rand(0, TAU) : rotY);
    tube(g, 0, 0.11, 0, 0.009, 0.22, '#5d8a4a', 4);
    for (var i = 0; i < 5; i++) {
      var a = (i * TAU) / 5;
      var p = box(g, Math.cos(a) * 0.045, 0.225, Math.sin(a) * 0.045, 0.055, 0.016, 0.03,
        petalColor || '#f0d071', -a);
      p.rotation.z = 0.25;
    }
    sphere(g, 0, 0.235, 0, 0.026, '#f6e06a', 0);
    return g;
  };

  /** Low leafy shrub. */
  N.bush = function (parent, x, z, scale, color) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, 0, z, scale, rand(0, TAU));
    var c = new T.Color(color || '#4d8b50');
    rock(g, 0, 0.2, 0, 0.29, 0.24, 0.27, c);
    rock(g, 0.16, 0.14, 0.06, 0.17, 0.15, 0.16, c.clone().multiplyScalar(1.12));
    rock(g, -0.13, 0.13, -0.09, 0.15, 0.13, 0.14, c.clone().multiplyScalar(0.86));
    return g;
  };

  /** Berry bush — a shrub plus a scatter of bright beads. */
  N.berryBush = function (parent, x, z, scale, berryColor) {
    var g = N.bush(parent, x, z, scale, '#3f7c48');
    for (var i = 0; i < 7; i++) {
      var a = rand(0, TAU), r = rand(0.1, 0.26);
      sphere(g, Math.cos(a) * r, rand(0.14, 0.33), Math.sin(a) * r, 0.032, berryColor || '#d2465a', 0);
    }
    return g;
  };

  /** Cattail / reed clump for pond edges. */
  N.reeds = function (parent, x, z, count, scale) {
    count = count || 6;
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, 0, z, scale, rand(0, TAU));
    for (var i = 0; i < count; i++) {
      var a = rand(0, TAU), r = rand(0, 0.13), h = rand(0.3, 0.55);
      var s = tube(g, Math.cos(a) * r, h * 0.5, Math.sin(a) * r, 0.011, h, '#7fa356', 4);
      s.rotation.z = rand(-0.16, 0.16);
      if (i % 2 === 0) cone(g, Math.cos(a) * r, h + 0.05, Math.sin(a) * r, 0.026, 0.11, '#8a6142', 5, 0.02);
    }
    return g;
  };

  /* --- stone --------------------------------------------------------------- */

  /** A scatter of two or three boulders. */
  N.boulders = function (parent, x, z, scale, color) {
    scale = scale === undefined ? 1 : scale;
    color = color || '#8c9490';
    var g = group(parent, x, 0, z, scale, rand(0, TAU));
    rock(g, 0, 0.18, 0, 0.36, 0.3, 0.33, color);
    rock(g, 0.3, 0.1, 0.12, 0.2, 0.17, 0.2, new T.Color(color).multiplyScalar(1.1));
    if (rand() > 0.4) rock(g, -0.22, 0.08, -0.18, 0.15, 0.13, 0.16, new T.Color(color).multiplyScalar(0.86));
    return g;
  };

  /** A standing crystal cluster. Slightly emissive so it reads at night. */
  N.crystals = function (parent, x, z, scale, color, glow) {
    scale = scale === undefined ? 1 : scale;
    color = color || '#7fd6e8';
    var g = group(parent, x, 0, z, scale, rand(0, TAU));
    var m = glow
      ? mat(color, { emissive: color, emissiveIntensity: 0.9, roughness: 0.28, metalness: 0.1 })
      : mat(color, { roughness: 0.3, metalness: 0.08 });
    for (var i = 0; i < 4; i++) {
      var a = (i * TAU) / 4 + rand(-0.4, 0.4);
      var r = rand(0.04, 0.16);
      var h = rand(0.22, 0.6);
      var shard = mesh(g, new T.CylinderGeometry(0, rand(0.05, 0.09), h, 5, 1), m,
        Math.cos(a) * r, h * 0.5, Math.sin(a) * r);
      shard.rotation.set(rand(-0.22, 0.22), rand(0, TAU), rand(-0.22, 0.22));
    }
    return g;
  };

  /** A weathered signpost with a blank arrow board. */
  N.signpost = function (parent, x, z, heading, color) {
    var g = group(parent, x, 0, z, 1, heading || 0);
    tube(g, 0, 0.3, 0, 0.028, 0.6, '#8c6a48', 6);
    var boardA = box(g, 0.13, 0.5, 0, 0.3, 0.1, 0.02, color || '#c9a86f');
    boardA.rotation.y = 0.1;
    var boardB = box(g, -0.13, 0.36, 0, 0.26, 0.09, 0.02, '#b89460');
    boardB.rotation.y = -0.14;
    return g;
  };

  /* --- water --------------------------------------------------------------- */

  /** A still pool: a flat translucent disc with a stony rim. */
  N.pond = function (parent, x, z, radius, waterColor, rimColor) {
    var g = group(parent, x, 0, z);
    var disc = mesh(g, new T.CircleGeometry(radius, 22),
      mat(waterColor || '#48b7ae', {
        transparent: true, opacity: 0.78, roughness: 0.16, metalness: 0.12, side: T.DoubleSide,
      }), 0, 0.035, 0);
    disc.geometry.rotateX(-Math.PI / 2);
    disc.castShadow = false;
    for (var i = 0; i < 14; i++) {
      var a = (i / 14) * TAU + rand(-0.1, 0.1);
      var r = radius * rand(0.94, 1.06);
      rock(g, Math.cos(a) * r, 0.03, Math.sin(a) * r,
        rand(0.07, 0.15), rand(0.05, 0.1), rand(0.07, 0.14), rimColor || '#9aa79a');
    }
    return g;
  };

  /** A waterfall sheet plus a drifting curtain of instanced droplets. */
  N.waterfall = function (parent, path, widths, color, dropCount) {
    var m = mat(color || '#8addd4', {
      emissive: '#359d9b', emissiveIntensity: 0.1,
      transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false,
    });
    ribbon(parent, path, widths, m);

    var n = dropCount || 14;
    var holder = group(parent);
    var drops = new T.InstancedMesh(
      new T.CylinderGeometry(0.012, 0.009, 0.11, 3),
      mat('#dcfff4', { transparent: true, opacity: 0.7, depthWrite: false }),
      n
    );
    drops.castShadow = false;
    holder.add(drops);
    var scratch = new T.Object3D();
    var top = path[0];
    var bottom = path[path.length - 1];
    dyn(holder, function (t) {
      for (var i = 0; i < n; i++) {
        var k = (t * 0.7 + i / n) % 1;
        scratch.position.set(
          top[0] + (bottom[0] - top[0]) * k + ((i % 3) - 1) * 0.05,
          top[1] + (bottom[1] - top[1]) * k,
          top[2] + (bottom[2] - top[2]) * k + ((i % 2) - 0.5) * 0.05
        );
        scratch.scale.setScalar(1);
        scratch.updateMatrix();
        drops.setMatrixAt(i, scratch.matrix);
      }
      drops.instanceMatrix.needsUpdate = true;
    });
    return holder;
  };

  /* --- fire, smoke, sparkle ------------------------------------------------ */

  /** A cluster of flame shards that flicker and can be switched off.
   *  One instanced draw call: every campfire in the world costs one. */
  N.flames = function (parent, x, y, z, scale, color) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, y, z, scale);
    var count = 6;
    var im = new T.InstancedMesh(
      new T.ConeGeometry(0.07, 0.3, 4),
      mat(color || '#f7a13c', {
        emissive: color || '#f7a13c', emissiveIntensity: 1.5,
        transparent: true, opacity: 0.92, depthWrite: false,
      }),
      count
    );
    im.castShadow = false;
    im.renderOrder = 4;
    /* Instances are tinted individually so the fire has hot and cool tongues. */
    var tint = new T.Color();
    var palette = ['#f7a13c', '#f4d06a', '#e8663e'];
    im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    for (var c = 0; c < count; c++) {
      tint.set(palette[c % 3]);
      im.setColorAt(c, tint);
    }
    im.instanceColor.needsUpdate = true;
    g.add(im);

    var scratch = new T.Object3D();
    dyn(g, function (t) {
      for (var i = 0; i < count; i++) {
        var a = (i * TAU) / count;
        var f = 0.7 + Math.abs(Math.sin(t * 6 + i * 1.7)) * 0.6;
        scratch.position.set(Math.cos(a) * 0.05, 0.1 + f * 0.06, Math.sin(a) * 0.05);
        scratch.scale.set(1, f, 1);
        scratch.rotation.set(0, t * 1.4 + i, 0);
        scratch.updateMatrix();
        im.setMatrixAt(i, scratch.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    });
    return g;
  };

  /** Rising puffs on a loop — chimneys, campfires, geysers, volcano vents.
   *  Instanced, so a puff fades by shrinking rather than by changing alpha. */
  N.smoke = function (parent, x, y, z, opts) {
    opts = opts || {};
    var count = opts.count || 6;
    var rise = opts.rise || 1.4;
    var spread = opts.spread === undefined ? 0.22 : opts.spread;
    var size = opts.size || 0.14;
    var speed = opts.speed || 0.22;
    var g = group(parent, x, y, z);
    var im = new T.InstancedMesh(
      C.UNIT_ICO0,
      mat(opts.color || '#d8dcd4', {
        transparent: true,
        opacity: 0.34 * (opts.opacity === undefined ? 1 : opts.opacity),
        depthWrite: false, roughness: 1,
      }),
      count
    );
    im.castShadow = false;
    im.renderOrder = 4;
    g.add(im);

    var scratch = new T.Object3D();
    dyn(g, function (t) {
      for (var i = 0; i < count; i++) {
        var k = (t * speed + i / count) % 1;
        /* grow in, drift up, shrink out */
        var envelope = Math.sin(k * Math.PI);
        var s = size * (0.5 + k * 1.4) * Math.max(0.001, envelope);
        scratch.position.set(Math.sin(k * 5 + i) * spread * k, k * rise, Math.cos(k * 4 + i) * spread * k);
        scratch.scale.setScalar(s);
        scratch.rotation.set(k * 2, i + k, k);
        scratch.updateMatrix();
        im.setMatrixAt(i, scratch.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    });
    return g;
  };

  /** Instanced motes that drift in a slow volume: fireflies, pollen, embers,
   *  snow, bubbles. The single cheapest way to make a place feel alive. */
  N.motes = function (parent, opts) {
    opts = opts || {};
    var count = opts.count || 24;
    var radius = opts.radius || 1.6;
    var height = opts.height === undefined ? 1.2 : opts.height;
    var size = opts.size || 0.03;
    var speed = opts.speed || 0.35;
    var g = group(parent, opts.x || 0, opts.y || 0, opts.z || 0);
    var m = mat(opts.color || '#ffe9a0', {
      emissive: opts.color || '#ffe9a0',
      emissiveIntensity: opts.glow === undefined ? 1.6 : opts.glow,
      transparent: true, opacity: opts.opacity === undefined ? 0.9 : opts.opacity,
      depthWrite: false, roughness: 1,
    });
    var im = new T.InstancedMesh(new T.IcosahedronGeometry(size, 0), m, count);
    im.castShadow = false;
    im.renderOrder = 5;
    g.add(im);
    var seeds = [];
    for (var i = 0; i < count; i++) {
      seeds.push({ a: rand(0, TAU), r: rand(0.25, 1) * radius, h: rand(0, 1), s: rand(0.5, 1.5), p: rand(0, TAU) });
    }
    var scratch = new T.Object3D();
    dyn(g, function (t) {
      for (var i = 0; i < count; i++) {
        var s = seeds[i];
        var a = s.a + t * speed * 0.4 * s.s;
        var bob = Math.sin(t * s.s * 1.4 + s.p);
        scratch.position.set(
          Math.cos(a) * s.r * (0.85 + 0.15 * Math.sin(t * 0.6 + s.p)),
          s.h * height + bob * height * 0.18,
          Math.sin(a) * s.r * (0.85 + 0.15 * Math.cos(t * 0.5 + s.p))
        );
        scratch.scale.setScalar(0.6 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3 * s.s + s.p)));
        scratch.updateMatrix();
        im.setMatrixAt(i, scratch.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    });
    g.userData.instanced = im;
    return g;
  };

  /* --- little animals ------------------------------------------------------ */

  /** A bird that loops on a slow circle above a point. */
  N.bird = function (parent, x, y, z, radius, color, speed) {
    var orbit = pivot(parent, x, y, z);
    var body = pivot(orbit, radius, 0, 0);
    var b = rock(body, 0, 0, 0, 0.09, 0.07, 0.13, color || '#f0f0e6');
    b.castShadow = false;
    var wingL = pivot(body, -0.07, 0.02, 0);
    var wingR = pivot(body, 0.07, 0.02, 0);
    var wl = box(wingL, -0.09, 0, 0, 0.19, 0.012, 0.09, color || '#f0f0e6');
    var wr = box(wingR, 0.09, 0, 0, 0.19, 0.012, 0.09, color || '#f0f0e6');
    wl.castShadow = wr.castShadow = false;
    cone(body, 0, 0, 0.12, 0.03, 0.07, '#e8a24a', 4).rotation.x = Math.PI / 2;
    bake(body, true);
    var sp = speed || 0.5;
    dyn(orbit, function (t) {
      orbit.rotation.y = t * sp;
      body.position.y = Math.sin(t * sp * 2) * 0.18;
      body.rotation.z = Math.sin(t * sp * 2) * 0.12;
      var flap = Math.sin(t * 9) * 0.7;
      wingL.rotation.z = flap;
      wingR.rotation.z = -flap;
    });
    return orbit;
  };

  /** A fish that swims a lazy figure of eight. */
  N.fish = function (parent, x, y, z, scale, color) {
    scale = scale === undefined ? 1 : scale;
    var swim = pivot(parent, x, y, z);
    var body = pivot(swim, 0, 0, 0);
    body.scale.setScalar(scale);
    var b = rock(body, 0, 0, 0, 0.1, 0.13, 0.24, color || '#f2a45c');
    b.castShadow = false;
    var tailPivot = pivot(body, 0, 0, -0.2);
    var tail = mesh(tailPivot, poly([[0, 0, 0], [-0.11, 0.13, -0.14], [0.11, 0.13, -0.14],
      [0, 0, 0], [-0.11, -0.09, -0.13], [0.11, -0.09, -0.13]]),
      mat(color || '#f2a45c', { side: T.DoubleSide }));
    tail.castShadow = false;
    var fin = mesh(body, poly([[0, 0.1, 0.02], [0, 0.24, -0.09], [0, 0.09, -0.12]]),
      mat('#f7c98a', { side: T.DoubleSide }));
    fin.castShadow = false;
    sphere(body, 0.07, 0.04, 0.16, 0.022, '#1e2a2e', 0).castShadow = false;
    sphere(body, -0.07, 0.04, 0.16, 0.022, '#1e2a2e', 0).castShadow = false;
    bake(body, true);
    var phase = rand(0, TAU);
    var speed = rand(0.4, 0.75);
    dyn(swim, function (t) {
      var u = t * speed + phase;
      swim.position.set(x + Math.sin(u) * 1.5, y + Math.sin(u * 2) * 0.28, z + Math.sin(u * 2) * 0.9);
      swim.rotation.y = -Math.atan2(Math.cos(u * 2) * 1.8, Math.cos(u) * 1.5) + Math.PI / 2;
      tailPivot.rotation.y = Math.sin(t * 7 + phase) * 0.5;
      body.rotation.z = Math.sin(t * 3 + phase) * 0.1;
    });
    return swim;
  };

  /** A butterfly that flutters around a small area. */
  N.butterfly = function (parent, x, y, z, color, radius) {
    radius = radius || 0.9;
    var g = pivot(parent, x, y, z);
    var body = group(g);
    tube(body, 0, 0, 0, 0.012, 0.09, '#3c3630', 4).rotation.x = Math.PI / 2;
    var wl = pivot(body, -0.01, 0, 0);
    var wr = pivot(body, 0.01, 0, 0);
    var m = mat(color || '#f0a0c8', { side: T.DoubleSide, transparent: true, opacity: 0.95 });
    var a = mesh(wl, poly([[0, 0, 0.04], [-0.11, 0.02, 0.09], [-0.1, 0, -0.05]]), m);
    var b = mesh(wr, poly([[0, 0, 0.04], [0.11, 0.02, 0.09], [0.1, 0, -0.05]]), m);
    a.castShadow = b.castShadow = false;
    var phase = rand(0, TAU);
    dyn(g, function (t) {
      var u = t * 0.55 + phase;
      g.position.set(
        x + Math.cos(u) * radius,
        y + Math.sin(t * 1.7 + phase) * 0.22 + 0.1,
        z + Math.sin(u * 1.3) * radius
      );
      g.rotation.y = -u * 1.1;
      var flap = 0.4 + Math.abs(Math.sin(t * 13 + phase)) * 1.0;
      wl.rotation.z = flap;
      wr.rotation.z = -flap;
    });
    return g;
  };

  /** A small hopping critter — rabbit, penguin chick, desert fox — that idles
   *  in place with a bounce. Colours make the species. */
  N.critter = function (parent, x, z, opts) {
    opts = opts || {};
    var body = opts.body || '#e9e2d2';
    var accent = opts.accent || '#d8b9a0';
    var g = pivot(parent, x, 0, z);
    g.rotation.y = opts.heading === undefined ? rand(0, TAU) : opts.heading;
    var s = opts.scale === undefined ? 1 : opts.scale;
    var hop = group(g, 0, 0, 0, s);
    rock(hop, 0, 0.15, 0, 0.15, 0.14, 0.19, body);
    var head = pivot(hop, 0, 0.28, 0.1);
    rock(head, 0, 0, 0, 0.11, 0.1, 0.1, body);
    sphere(head, 0.055, 0.02, 0.08, 0.019, '#25201c', 0);
    sphere(head, -0.055, 0.02, 0.08, 0.019, '#25201c', 0);
    rock(head, 0, -0.02, 0.1, 0.033, 0.026, 0.03, accent, true);
    if (opts.ears !== false) {
      for (var i = -1; i <= 1; i += 2) {
        var ear = box(head, i * 0.05, 0.11, -0.01, 0.035, 0.14, 0.02, body);
        ear.rotation.z = i * 0.2;
      }
    }
    if (opts.tail !== false) sphere(hop, 0, 0.17, -0.19, 0.045, opts.tailColor || '#fdf6e8', 1);
    bake(head, true);
    bake(hop, true);
    dyn(g, function (t) {
      var u = t * 1.1 + x * 3 + z * 2;
      var jump = Math.max(0, Math.sin(u)) * 0.09;
      hop.position.y = jump;
      hop.rotation.x = -jump * 0.9;
      head.rotation.y = Math.sin(u * 0.4) * 0.5;
      head.rotation.x = Math.sin(u * 0.7) * 0.12;
    });
    return g;
  };

  TW.nature = N;
})(typeof window !== 'undefined' ? window : this);
