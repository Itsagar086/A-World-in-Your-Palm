/* =============================================================================
 * A World in Your Palm — 30-planet.js
 * The globe. Eight biome centres are scattered over a sphere; every point on
 * the surface belongs to whichever centre is nearest, with a wobbled distance
 * metric so the borders are ragged rather than Voronoi-clean. Elevation is a
 * per-biome constant plus local detail, and the walkable surface is that
 * height clamped up to sea level so the seas are swimmable, not fatal.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = global.TW;
  var C = TW.core;
  var mat = C.mat, rand = C.rand, clamp = C.clamp, lerp = C.lerp, smoothstep = C.smoothstep;
  var TAU = C.TAU, DEG = C.DEG;

  /** Planet radius. Everything in the game is measured against this. */
  var RADIUS = 14;
  /** Sea level, a hair above the mean radius so shorelines read cleanly. */
  var SEA = RADIUS + 0.025;
  var UP = new T.Vector3(0, 1, 0);

  /** Latitude/longitude (degrees) to a unit vector. */
  function latLon(lat, lon) {
    return new T.Vector3(
      Math.cos(lat * DEG) * Math.sin(lon * DEG),
      Math.sin(lat * DEG),
      Math.cos(lat * DEG) * Math.cos(lon * DEG)
    );
  }

  /* --- the eight regions ---------------------------------------------------- */

  var BIOMES = [
    {
      id: 'mosswood', name: 'Banyan Hollow', kind: 'Forest',
      tagline: 'Every long journey starts with one small step off the path.',
      color: '#4e9159', accent: '#a7d886', lat: 18, lon: -6, elevation: 0.25,
    },
    {
      id: 'honeyfield', name: 'Marigold Fields', kind: 'Meadow',
      tagline: 'A little care, and the whole hillside answers.',
      color: '#93aa5f', accent: '#f0d27a', lat: 30, lon: -74, elevation: 0.23,
    },
    {
      id: 'amberdunes', name: 'Saffron Dunes', kind: 'Desert',
      tagline: 'Every dune is hiding something green.',
      color: '#e3b76a', accent: '#f2cb8a', lat: 24, lon: 68, elevation: 0.26,
    },
    {
      id: 'driftbay', name: 'Coconut Cove', kind: 'Coast',
      tagline: 'Leave nothing but very small footprints.',
      color: '#e7cf97', accent: '#f5ab86', lat: -24, lon: 62, elevation: 0.13,
    },
    {
      id: 'coralhollow', name: 'Pearl Reef', kind: 'Reef',
      tagline: 'There is a whole other world under the blue.',
      color: '#5f8f8b', accent: '#7ad9d4', lat: -42, lon: -26, elevation: -0.68,
    },
    {
      id: 'cinderpeak', name: 'Barren Peak', kind: 'Volcano',
      tagline: 'Even a sleeping mountain likes to be asked how it is.',
      color: '#6b564c', accent: '#f59a68', lat: 2, lon: -152, elevation: 0.33,
    },
    {
      id: 'frostveil', name: 'Snow Valley', kind: 'Tundra',
      tagline: 'The quietest places keep the brightest secrets.',
      color: '#d9ece3', accent: '#b3ddef', lat: 66, lon: 156, elevation: 0.31,
    },
    {
      id: 'glowgrove', name: 'Firefly Hollow', kind: 'Hollow',
      tagline: 'Some things only show themselves after dark.',
      color: '#3f5c72', accent: '#9fe0c8', lat: -30, lon: 150, elevation: 0.28,
    },
  ].map(function (b, i) {
    b.index = i;
    b.center = latLon(b.lat, b.lon);
    return b;
  });

  var BY_ID = {};
  BIOMES.forEach(function (b) { BY_ID[b.id] = b; });

  /* Each region gets a local tangent frame so props can be authored in flat
   * (x, z) metres around the region centre and still land upright on a sphere. */
  BIOMES.forEach(function (b) {
    b.east = new T.Vector3(Math.cos(b.lon * DEG), 0, -Math.sin(b.lon * DEG));
    b.south = new T.Vector3().crossVectors(b.east, b.center).normalize();
  });

  /** Local (x, z) metres in a region to a surface normal. */
  function normalAt(biomeId, x, z) {
    var b = BY_ID[biomeId];
    return b.center.clone().multiplyScalar(RADIUS)
      .addScaledVector(b.east, x || 0)
      .addScaledVector(b.south, z || 0)
      .normalize();
  }

  /** The inverse: a surface normal back to local (x, z) in a given region. */
  function localAt(biomeId, normal) {
    var b = BY_ID[biomeId];
    var k = RADIUS / Math.max(0.1, normal.dot(b.center));
    return { x: normal.dot(b.east) * k, z: normal.dot(b.south) * k };
  }

  /* --- classification ------------------------------------------------------- */

  /* Nearest centre wins, but the "distance" is perturbed by a cheap 3D sine
   * field so the borders wander instead of forming clean great-circle arcs.
   * The runner-up and the margin come back too, which is what lets elevation
   * blend smoothly across a border rather than forming a cliff. */
  function classify(p) {
    var best = BIOMES[0], second = BIOMES[1];
    var bestScore = -Infinity, secondScore = -Infinity;
    for (var i = 0; i < BIOMES.length; i++) {
      var b = BIOMES[i];
      var score = b.center.x * p.x + b.center.y * p.y + b.center.z * p.z +
        0.018 * Math.sin(p.x * 9 + b.index * 2.3) * Math.sin(p.y * 8 - p.z * 6 + b.index * 0.6);
      if (score > bestScore) {
        second = best; secondScore = bestScore;
        best = b; bestScore = score;
      } else if (score > secondScore) {
        second = b; secondScore = score;
      }
    }
    return { best: best, second: second, gap: bestScore - secondScore };
  }

  function biomeAt(p) {
    return classify(p).best;
  }

  /** Per-region elevation, including the local shaping that gives each region
   *  its silhouette: a shelving beach, rolling dunes, a volcanic cone. */
  function regionElevation(b, p) {
    var e = b.elevation;
    if (b.id === 'driftbay') {
      /* A shore that ramps down into the sea on the seaward (+x) side. */
      var l = localAt('driftbay', p);
      var shore = 2.8 + Math.sin(l.z * 0.8) * 0.3;
      e = lerp(0.14, -0.3, smoothstep(l.x, shore - 0.5, shore + 0.5));
    } else if (b.id === 'amberdunes') {
      e += 0.11 * Math.sin(p.x * 19 + p.z * 8) * Math.sin(p.y * 11 + p.z * 6);
    } else if (b.id === 'cinderpeak') {
      /* A broad cone with a crater bitten out of the top. The slope is kept
       * under about 20 degrees: props stand along the sphere normal, not the
       * terrain normal, so anything steeper starts to look sunk. */
      var lc = localAt('cinderpeak', p);
      var d = Math.hypot(lc.x, lc.z);
      var cone = Math.max(0, 1 - d / 5.6) * 2.2;
      /* Flatten the crater floor rather than dishing it: the crater props are
       * one placement, so they all sit on the height at the centre. */
      if (d < 1.9) cone = Math.min(cone, 0.95 + Math.max(0, d - 1.35) * 1.6);
      e += cone;
    } else if (b.id === 'glowgrove') {
      /* A bowl inside a ring of hills — the grove sits down in the shade. */
      var lg = localAt('glowgrove', p);
      var dg = Math.hypot(lg.x, lg.z);
      e += Math.max(0, 1 - Math.abs(dg - 5.0) / 3.0) * 0.9 - Math.max(0, 1 - dg / 4.0) * 0.55;
    } else if (b.id === 'frostveil') {
      /* One snow hill, deliberately away from the camp and the frozen lake. */
      var lf = localAt('frostveil', p);
      e += Math.max(0, 1 - Math.hypot(lf.x + 3.6, lf.z - 3.4) / 3.8) * 1.15;
    }
    return e;
  }

  /** Raw terrain radius at a unit direction — may fall below sea level. */
  function terrainRadius(p) {
    var c = classify(p);
    var w = smoothstep(c.gap, 0, 0.065) * 0.5 + 0.5;
    var e = regionElevation(c.best, p) * w + regionElevation(c.second, p) * (1 - w);
    /* Three octaves: rolling swells you notice while walking, then two fine
     * layers that keep the flat-shaded facets from lining up into bands. */
    var detail =
      0.062 * Math.sin(p.x * 7.2 + p.y * 5.4) * Math.sin(p.z * 6.1 - p.y * 4.8) +
      0.032 * Math.sin(p.x * 27 + p.y * 13) * Math.sin(p.z * 21 - p.y * 19) +
      0.025 * Math.sin(p.x * 13 - p.z * 11 + p.y * 10);
    return RADIUS + e + detail;
  }

  /** The walkable surface: terrain, but never below the waterline. */
  function surfaceRadius(p) {
    return Math.max(SEA, terrainRadius(p));
  }

  /** True where the explorer would be wading. */
  function isWater(p) {
    return terrainRadius(p) < SEA - 0.025;
  }

  /* --- world construction --------------------------------------------------- */

  function buildPlanet(options) {
    options = options || {};
    var detail = options.terrainDetail || 40;

    var root = new T.Group();
    root.name = 'A World in Your Palm';
    var propRoot = new T.Group();
    root.add(propRoot);

    var landmarks = [];
    var colliders = [];
    var wisps = [];
    var updaters = [];
    var localRand = C.makeRandom(49281);

    /* --- terrain shell ----------------------------------------------------- */

    var geo = new T.IcosahedronGeometry(RADIUS, detail);
    var pos = geo.getAttribute('position');
    var colors = new Float32Array(pos.count * 3);
    var v = new T.Vector3();
    var faceMid = new T.Vector3();
    var col = new T.Color();

    for (var i = 0; i < pos.count; i += 3) {
      faceMid.set(0, 0, 0);
      for (var k = 0; k < 3; k++) {
        v.fromBufferAttribute(pos, i + k).normalize();
        faceMid.add(v);
        v.multiplyScalar(terrainRadius(v));
        pos.setXYZ(i + k, v.x, v.y, v.z);
      }
      faceMid.normalize();
      var b = biomeAt(faceMid);
      col.set(b.color).multiplyScalar(localRand(0.92, 1.045));
      /* Submerged land near a beach turns to wet sand; the open reef gets
       * occasional lighter facets so the seabed is not a flat wash. */
      if (isWater(faceMid)) {
        if (b.id === 'driftbay') col.set('#8cbcac').multiplyScalar(localRand(0.95, 1.05));
        else if (b.id === 'coralhollow' && i % 15 === 0) col.multiplyScalar(1.12);
      }
      if (b.id === 'cinderpeak' && terrainRadius(faceMid) > RADIUS + 0.72 && i % 7 === 0) {
        col.set('#3b3230').multiplyScalar(localRand(0.9, 1.15));
      }
      for (var c2 = 0; c2 < 3; c2++) {
        colors[(i + c2) * 3] = col.r;
        colors[(i + c2) * 3 + 1] = col.g;
        colors[(i + c2) * 3 + 2] = col.b;
      }
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    var terrain = new T.Mesh(geo, mat('#ffffff', { vertexColors: true, roughness: 0.99 }));
    terrain.name = 'terrain';
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    root.add(terrain);

    /* --- sea shell --------------------------------------------------------- */

    var seaGeo = new T.IcosahedronGeometry(SEA, Math.min(34, detail));
    var seaPos = seaGeo.getAttribute('position');
    var seaColors = new Float32Array(seaPos.count * 3);
    for (var s = 0; s < seaPos.count; s += 3) {
      v.fromBufferAttribute(seaPos, s).normalize();
      var depth = SEA - terrainRadius(v);
      col.set(depth < 0.38 ? '#57d2c2' : '#2a9db0').multiplyScalar(localRand(0.95, 1.04));
      for (var sc = 0; sc < 3; sc++) {
        seaColors[(s + sc) * 3] = col.r;
        seaColors[(s + sc) * 3 + 1] = col.g;
        seaColors[(s + sc) * 3 + 2] = col.b;
      }
    }
    seaGeo.setAttribute('color', new T.Float32BufferAttribute(seaColors, 3));
    var sea = new T.Mesh(seaGeo, mat('#ffffff', {
      vertexColors: true, transparent: true, opacity: 0.56,
      depthWrite: false, roughness: 0.35, metalness: 0.05,
    }));
    sea.name = 'sea';
    sea.renderOrder = 3;
    sea.receiveShadow = false;
    root.add(sea);

    /* --- authoring context ------------------------------------------------- */

    /* This object is what the biome files see. Everything they build goes
     * through `place`, which handles the tangent frame maths for them. */
    var ctx = {
      root: propRoot,
      rand: localRand,
      RADIUS: RADIUS,
      SEA: SEA,
      normalAt: normalAt,
      localAt: localAt,
      surfaceRadius: surfaceRadius,
      terrainRadius: terrainRadius,
      biomeAt: biomeAt,
      isWater: isWater,
      biomes: BY_ID,

      /**
       * Drop a prop onto the surface of a region.
       * @param {string} biomeId
       * @param {number} x  local metres, +east
       * @param {number} z  local metres, +south
       * @param {function} build  receives the oriented, grounded group
       * @param {object} opts  { heading, scale, lift }
       */
      place: function (biomeId, x, z, build, opts) {
        opts = opts || {};
        var g = new T.Group();
        g.name = biomeId + '-prop';
        var n = normalAt(biomeId, x, z);
        g.position.copy(n).multiplyScalar(surfaceRadius(n) + (opts.lift || 0));
        /* Build an orthonormal basis with +Y along the surface normal so the
         * prop's own local axes line up with the region's east/south. */
        var b = BY_ID[biomeId];
        var east = b.east.clone().addScaledVector(n, -b.east.dot(n)).normalize();
        var south = new T.Vector3().crossVectors(east, n).normalize();
        g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(east, n, south));
        if (opts.heading) g.rotateY(opts.heading);
        if (opts.scale) g.scale.setScalar(opts.scale);
        propRoot.add(g);
        if (build) build(g);
        return g;
      },

      /** Register a walk-blocking spherical cap. */
      block: function (biomeId, x, z, radius) {
        colliders.push({ normal: normalAt(biomeId, x, z), radius: radius, biome: biomeId });
      },

      /** Register an interactive landmark (a "small wonder"). */
      wonder: function (spec) {
        var b = BY_ID[spec.biome];
        var lm = Object.assign(
          { radius: 2.5, color: b.accent, completed: false },
          spec,
          { normal: normalAt(spec.biome, spec.x, spec.z) }
        );
        landmarks.push(lm);
        return lm;
      },

      /** Register a collectible wisp. */
      wisp: function (biomeId, x, z, lift) {
        wisps.push({
          id: biomeId + '-wisp-' + wisps.length,
          biome: biomeId,
          normal: normalAt(biomeId, x, z),
          lift: lift === undefined ? 0.9 : lift,
          taken: false,
        });
      },

      /** Something that needs a per-frame update outside the prop hierarchy. */
      tick: function (fn) { updaters.push(fn); },

      /**
       * A group whose local frame *is* world space, for the handful of things
       * that are too big to sit on one anchor — an aurora arcing over a whole
       * region, for instance, has to follow the curve of the planet.
       */
      sky: function (build) {
        var g = new T.Group();
        g.name = 'sky-feature';
        propRoot.add(g);
        if (build) build(g);
        return g;
      },

      /**
       * Lay a footpath across a region. Points are local (x, z) pairs; the
       * path is resampled, given a constant width, and draped on the terrain.
       */
      path: function (biomeId, points, width, color, lift) {
        width = width === undefined ? 0.7 : width;
        lift = lift === undefined ? 0.035 : lift;
        var dense = [];
        for (var i = 0; i < points.length - 1; i++) {
          var a = points[i], b2 = points[i + 1];
          var steps = Math.max(2, Math.ceil(Math.hypot(b2[0] - a[0], b2[1] - a[1]) / 0.22));
          for (var s2 = 0; s2 < steps; s2++) {
            var t = s2 / steps;
            dense.push([lerp(a[0], b2[0], t), lerp(a[1], b2[1], t)]);
          }
        }
        dense.push(points[points.length - 1]);

        var verts = [];
        var faces = [];
        for (var j = 0; j < dense.length; j++) {
          var prev = dense[Math.max(0, j - 1)];
          var next = dense[Math.min(dense.length - 1, j + 1)];
          var dx = next[0] - prev[0], dz = next[1] - prev[1];
          var len = Math.hypot(dx, dz) || 1;
          for (var side = -1; side <= 1; side += 2) {
            var n2 = normalAt(biomeId,
              dense[j][0] - (dz / len) * width * 0.5 * side,
              dense[j][1] + (dx / len) * width * 0.5 * side);
            n2.multiplyScalar(surfaceRadius(n2) + lift);
            verts.push(n2.toArray());
          }
          if (j) faces.push([j * 2 - 2, j * 2 - 1, j * 2], [j * 2 - 1, j * 2 + 1, j * 2]);
        }
        var m = new T.Mesh(C.poly(verts, faces), mat(color || '#cab78a', {
          side: T.DoubleSide, roughness: 0.94,
        }));
        m.receiveShadow = true;
        propRoot.add(m);
        return m;
      },
    };

    /* --- populate ---------------------------------------------------------- */

    TW.biomes.buildAll(ctx);

    /* --- trails between neighbouring regions -------------------------------- */

    var TRAILS = [
      ['mosswood', 'honeyfield'], ['mosswood', 'amberdunes'], ['mosswood', 'driftbay'],
      ['honeyfield', 'cinderpeak'], ['amberdunes', 'frostveil'], ['driftbay', 'coralhollow'],
      ['coralhollow', 'cinderpeak'], ['frostveil', 'cinderpeak'], ['driftbay', 'glowgrove'],
      ['glowgrove', 'frostveil'],
    ];
    for (var t2 = 0; t2 < TRAILS.length; t2++) {
      var from = normalAt(TRAILS[t2][0], 0, 2.8);
      var to = normalAt(TRAILS[t2][1], 0, 2.8);
      var arc = Math.acos(clamp(from.dot(to), -1, 1));
      var steps2 = Math.floor((arc * RADIUS) / 0.52);
      for (var st = 0; st <= steps2; st++) {
        var f = st / steps2;
        if (f < 0.16 || f > 0.84) continue;
        var p2 = from.clone().multiplyScalar(Math.sin((1 - f) * arc))
          .addScaledVector(to, Math.sin(f * arc)).normalize();
        if (isWater(p2)) continue;
        var blocked = false;
        for (var cc = 0; cc < colliders.length; cc++) {
          if (p2.angleTo(colliders[cc].normal) * RADIUS < colliders[cc].radius + 0.5) { blocked = true; break; }
        }
        if (blocked) continue;
        var marker = new T.Group();
        marker.position.copy(p2).multiplyScalar(surfaceRadius(p2) + 0.025);
        marker.quaternion.setFromUnitVectors(UP, p2);
        propRoot.add(marker);
        var here = biomeAt(p2).id;
        var stoneColor = here === 'frostveil' ? '#9dbfc8'
          : here === 'cinderpeak' ? '#b09070'
          : here === 'glowgrove' ? '#7f9aa6'
          : '#dbca99';
        C.rock(marker, 0, 0, 0, localRand(0.12, 0.18), 0.025, localRand(0.14, 0.21), stoneColor);
        if (st % 7 === 0) {
          C.cone(marker, 0.22, 0.1, 0, 0.028, 0.18, '#7b8c58', 4).rotation.z = 0.3;
        }
      }
    }

    /* --- broadcast scatter -------------------------------------------------- */

    /* A Fibonacci sphere of filler props over the whole globe. This is what
     * makes the space *between* the authored set pieces feel inhabited. */
    var GOLDEN = Math.PI * (3 - Math.sqrt(5));
    var SCATTER = options.scatter || 1650;
    for (var f2 = 0; f2 < SCATTER; f2++) {
      var y = 1 - (2 * (f2 + 0.5)) / SCATTER;
      var r2 = Math.sqrt(1 - y * y);
      var theta = f2 * GOLDEN;
      var p3 = new T.Vector3(Math.cos(theta) * r2, y, Math.sin(theta) * r2);
      if (isWater(p3)) continue;
      var region = biomeAt(p3);
      var loc = localAt(region.id, p3);
      /* Keep clear of the authored heart of each region and of any collider. */
      if (Math.hypot(loc.x, loc.z) < 5.7) continue;
      var near = false;
      for (var cl = 0; cl < colliders.length; cl++) {
        if (p3.angleTo(colliders[cl].normal) * RADIUS < colliders[cl].radius + 0.3) { near = true; break; }
      }
      if (near) continue;

      var spot = new T.Group();
      spot.position.copy(p3).multiplyScalar(surfaceRadius(p3));
      spot.quaternion.setFromUnitVectors(UP, p3);
      propRoot.add(spot);
      scatterProp(spot, region, f2, theta, localRand, colliders, p3);
    }

    /* --- clouds ------------------------------------------------------------- */

    /* Every cloud lump in the sky is one instanced draw call. They only drift
     * as a set, so their transforms are written once at build time. */
    var CLOUDS = 13;
    var LUMPS = 4;
    var clouds = new T.Group();
    clouds.userData.dynamic = true;
    root.add(clouds);
    var cloudMesh = new T.InstancedMesh(
      C.UNIT_ICO0,
      mat('#eef1db', { transparent: true, opacity: 0.42, depthWrite: false, roughness: 1 }),
      CLOUDS * LUMPS
    );
    cloudMesh.castShadow = false;
    cloudMesh.renderOrder = 5;
    clouds.add(cloudMesh);
    var cloudScratch = new T.Object3D();
    for (var cd = 0; cd < CLOUDS; cd++) {
      var cp = latLon(14 + Math.sin(cd * 1.6) * 42, cd * 31 + 80);
      var cq = new T.Quaternion().setFromUnitVectors(UP, cp);
      var cbase = cp.clone().multiplyScalar(RADIUS + 3.4 + localRand(0, 0.9));
      for (var lump = 0; lump < LUMPS; lump++) {
        cloudScratch.position.set(
          (lump - 1.5) * 0.38 * 0.85,
          Math.sin(lump * 1.5) * 0.12 * 0.85,
          Math.sin(lump * 3) * 0.12 * 0.85
        ).applyQuaternion(cq).add(cbase);
        cloudScratch.quaternion.copy(cq);
        cloudScratch.scale.set(0.54, 0.27 + localRand(0, 0.13), 0.37).multiplyScalar(0.85);
        cloudScratch.updateMatrix();
        cloudMesh.setMatrixAt(cd * LUMPS + lump, cloudScratch.matrix);
      }
    }
    cloudMesh.instanceMatrix.needsUpdate = true;
    updaters.push(function (t) { clouds.rotation.y = t * 0.006; });

    /* --- wonder markers ------------------------------------------------------ */

    var markerMat = mat('#f6d68f', { emissive: '#e0b34f', emissiveIntensity: 0.2 });
    landmarks.forEach(function (lm) {
      var holder = new T.Group();
      holder.userData.dynamic = true;
      holder.position.copy(lm.normal).multiplyScalar(surfaceRadius(lm.normal));
      holder.quaternion.setFromUnitVectors(UP, lm.normal);
      root.add(holder);

      var ring = new T.Mesh(new T.TorusGeometry(0.3, 0.024, 4, 26),
        mat(lm.color, { emissive: lm.color, emissiveIntensity: 0.18 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.07;
      ring.castShadow = false;
      holder.add(ring);

      var top = C.cone(holder, 0, 1.68, 0, 0.115, 0.24, markerMat, 4);
      var bottom = C.cone(holder, 0, 1.52, 0, 0.115, 0.17, markerMat, 4);
      bottom.rotation.x = Math.PI;
      top.castShadow = bottom.castShadow = false;

      lm.marker = holder;
      lm.ring = ring;
      updaters.push(function (t) {
        var bob = 1.66 + Math.sin(t * 2 + lm.normal.x * 4) * 0.09;
        top.position.y = bob;
        bottom.position.y = bob - 0.18;
        top.rotation.y = bottom.rotation.y = t * 0.6;
        top.visible = bottom.visible = !lm.completed;
        ring.scale.setScalar(lm.completed ? 0.6 : 1 + Math.sin(t * 2) * 0.05);
      });
    });

    /* --- wisps --------------------------------------------------------------- */

    var wispMat = mat('#bff5e4', {
      emissive: '#8ff0d4', emissiveIntensity: 2.2,
      transparent: true, opacity: 0.95, roughness: 1,
    });
    wisps.forEach(function (w) {
      var holder = new T.Group();
      holder.userData.dynamic = true;
      holder.position.copy(w.normal).multiplyScalar(surfaceRadius(w.normal) + w.lift);
      holder.quaternion.setFromUnitVectors(UP, w.normal);
      root.add(holder);
      var core = new T.Mesh(new T.OctahedronGeometry(0.11), wispMat);
      core.castShadow = false;
      holder.add(core);
      var halo = new T.Mesh(new T.IcosahedronGeometry(0.22, 1),
        mat('#8ff0d4', { transparent: true, opacity: 0.16, depthWrite: false, roughness: 1 }));
      halo.castShadow = false;
      halo.renderOrder = 5;
      holder.add(halo);
      w.object = holder;
      updaters.push(function (t) {
        if (w.taken) { holder.visible = false; return; }
        core.rotation.set(t * 0.9, t * 1.3, 0);
        core.position.y = Math.sin(t * 2.2 + w.normal.y * 6) * 0.13;
        halo.position.y = core.position.y;
        halo.scale.setScalar(1 + Math.sin(t * 3 + w.normal.x * 5) * 0.13);
      });
    });

    /* Fold every static prop in the world into a handful of draw calls, then
     * throw away the placement scaffolding: after baking, most of those 1 500
     * `place()` groups are empty husks that would still cost a matrix update
     * every frame. */
    C.bake(propRoot);
    pruneEmpty(propRoot);
    root.updateMatrixWorld(true);

    return {
      root: root,
      terrain: terrain,
      sea: sea,
      landmarks: landmarks,
      wisps: wisps,
      colliders: colliders,
      ctx: ctx,
      update: function (t) {
        for (var u = 0; u < updaters.length; u++) updaters[u](t);
      },
      stats: {
        triangles: C.countTriangles(root),
        colliders: colliders.length,
        landmarks: landmarks.length,
        wisps: wisps.length,
      },
    };
  }

  /** Drop every subtree that contains no renderable at all. */
  function pruneEmpty(root) {
    var removed = 0;
    function keep(node) {
      var alive = node.isMesh || node.isPoints || node.isLine || node.isLight;
      var children = node.children.slice();
      for (var i = 0; i < children.length; i++) {
        if (keep(children[i])) alive = true;
        else { children[i].removeFromParent(); removed++; }
      }
      return alive;
    }
    keep(root);
    root.userData.pruned = removed;
    return removed;
  }

  /* One filler prop, chosen by region. Deliberately repetitive but never
   * identical: the index drives which variant, the RNG drives the details. */
  function scatterProp(spot, region, index, theta, rnd, colliders, p) {
    var N = TW.nature;
    switch (region.id) {
      case 'mosswood':
        if (index % 3 === 0) {
          N.pine(spot, 0, 0, rnd(1, 1.95), index % 2 ? '#2f7857' : '#438c61', 0);
          colliders.push({ normal: p.clone(), radius: 0.17, biome: region.id });
        } else if (index % 7 === 0) {
          N.mushroom(spot, 0, 0, rnd(0.5, 0.9), index % 2 ? '#d1685c' : '#cf8f5a');
        } else {
          N.grass(spot, 0, 0, '#6fae62', rnd(0.7, 1.3), 0);
        }
        break;
      case 'honeyfield':
        if (index % 11 === 0) {
          N.broadleaf(spot, 0, 0, rnd(1.3, 1.9), '#69a75c');
        } else if (index % 4 === 0) {
          N.flower(spot, 0, 0, ['#f0d071', '#e88ea8', '#e5e0f0'][index % 3], rnd(0.8, 1.2));
        } else {
          N.grass(spot, 0, 0, '#b0c66f', rnd(0.7, 1.3), 0);
        }
        break;
      case 'amberdunes':
        if (index % 5 === 0) C.rock(spot, 0, 0.1, 0, 0.34, 0.22, 0.25, '#c48f54');
        else if (index % 13 === 0) N.snag(spot, 0, 0, rnd(0.5, 0.9), '#b2895b');
        else C.rock(spot, 0, 0, 0, 0.11, 0.045, 0.08, '#f1ce8a');
        break;
      case 'driftbay':
        if (index % 5 === 0) N.palm(spot, 0, 0, rnd(1.5, 2.2), theta);
        else if (index % 3 === 0) C.rock(spot, 0, 0.02, 0, rnd(0.07, 0.13), 0.05, rnd(0.07, 0.12), '#e6d3a8');
        else N.grass(spot, 0, 0, '#c3c47a', rnd(0.6, 1), 0);
        break;
      case 'cinderpeak':
        C.rock(spot, 0, 0.055, 0, rnd(0.11, 0.29), rnd(0.08, 0.28), rnd(0.11, 0.32),
          index % 2 ? '#756459' : '#3d4844');
        if (index % 9 === 0) N.snag(spot, 0, 0, rnd(0.7, 1.2), '#54453c');
        break;
      case 'frostveil':
        if (index % 6 === 0) C.rock(spot, 0, 0.26, 0, 0.22, 0.5, 0.18, '#abdbe1');
        else if (index % 5 === 0) N.pine(spot, 0, 0, rnd(0.9, 1.5), '#5c8a78', 0);
        else C.rock(spot, 0, 0.01, 0, 0.16, 0.055, 0.13, '#eef5e8');
        break;
      case 'glowgrove':
        if (index % 4 === 0) {
          N.mushroom(spot, 0, 0, rnd(0.7, 1.4), ['#7ae0c0', '#8ba6f0', '#c88ff0'][index % 3], true);
        } else if (index % 6 === 0) {
          N.crystals(spot, 0, 0, rnd(0.5, 0.9), '#8fe4d0', true);
        } else {
          N.grass(spot, 0, 0, '#4a7d72', rnd(0.6, 1.2), 0);
        }
        break;
      default:
        N.grass(spot, 0, 0, '#82b666', rnd(0.65, 1.3), 0);
    }
  }

  /* --- sky ------------------------------------------------------------------ */

  /** Stars and the thin atmospheric rim that wraps the globe. */
  function buildSky(scene) {
    var s = 27;
    var rnd = function () { return ((s = (s * 16807) % 2147483647) - 1) / 2147483646; };

    var positions = [];
    var colors = [];
    for (var i = 0; i < 520; i++) {
      var p = latLon(Math.asin(rnd() * 2 - 1) / DEG, rnd() * 360);
      p.multiplyScalar(70 + rnd() * 20);
      positions.push(p.x, p.y, p.z);
      var c = new T.Color(i % 8 === 0 ? '#e2bd76' : i % 3 === 0 ? '#9ebecb' : '#d8e0d5')
        .multiplyScalar(0.35 + rnd() * 0.45);
      colors.push(c.r, c.g, c.b);
    }
    var starGeo = new T.BufferGeometry();
    starGeo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    var starMat = new T.PointsMaterial({
      size: 0.085, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.72, depthWrite: false,
    });
    var stars = new T.Points(starGeo, starMat);
    stars.name = 'stars';
    scene.add(stars);

    var rimMat = new T.ShaderMaterial({
      transparent: true, side: T.BackSide, depthWrite: false,
      uniforms: { color: { value: new T.Color('#65bfc0') }, strength: { value: 0.085 } },
      vertexShader: [
        'varying vec3 vWorld;',
        'varying vec3 vOut;',
        'void main(){',
        '  vec4 p = modelMatrix * vec4(position, 1.0);',
        '  vWorld = p.xyz;',
        '  vOut = normalize(mat3(modelMatrix) * normal);',
        '  gl_Position = projectionMatrix * viewMatrix * p;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 color;',
        'uniform float strength;',
        'varying vec3 vWorld;',
        'varying vec3 vOut;',
        'void main(){',
        '  float rim = pow(1.0 - abs(dot(normalize(vOut), normalize(cameraPosition - vWorld))), 3.2);',
        '  gl_FragColor = vec4(color, rim * strength);',
        '}',
      ].join('\n'),
    });
    var rim = new T.Mesh(new T.SphereGeometry(RADIUS + 1, 64, 48), rimMat);
    rim.name = 'atmosphere';
    rim.renderOrder = 6;
    scene.add(rim);

    return { stars: stars, starMaterial: starMat, atmosphere: rimMat };
  }

  TW.planet = {
    RADIUS: RADIUS,
    SEA: SEA,
    UP: UP,
    BIOMES: BIOMES,
    BY_ID: BY_ID,
    latLon: latLon,
    normalAt: normalAt,
    localAt: localAt,
    biomeAt: biomeAt,
    classify: classify,
    terrainRadius: terrainRadius,
    surfaceRadius: surfaceRadius,
    isWater: isWater,
    build: buildPlanet,
    buildSky: buildSky,
  };
})(typeof window !== 'undefined' ? window : this);
