/* =============================================================================
 * A World in Your Palm — 20-props.js
 * The made things: shelters, fences, lanterns, boats, bridges, machinery.
 * Anything a biome uses more than once lives here so the world reads as one
 * civilisation rather than seven unrelated dioramas.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = global.TW;
  var C = TW.core;
  var group = C.group, pivot = C.pivot, mesh = C.mesh, box = C.box, rock = C.rock;
  var cone = C.cone, tube = C.tube, torus = C.torus, sphere = C.sphere;
  var link = C.link, beam = C.beam, poly = C.poly, slab = C.slab, ribbon = C.ribbon;
  var mat = C.mat, dyn = C.dyn, rand = C.rand, TAU = C.TAU;

  var P = {};

  /* A shared palette keeps the hand-painted-toy look consistent everywhere. */
  var PAL = (P.palette = {
    cream: '#f8ecd2',
    canvas: '#efe0bd',
    wood: '#bc8c58',
    woodDark: '#7a6047',
    woodWarm: '#c9974f',
    roofRed: '#d4614e',
    roofBlue: '#4e7fa0',
    roofGreen: '#5c8f6a',
    teal: '#47b5ad',
    gold: '#e5c784',
    brass: '#dfae5c',
    iron: '#4a5054',
    rope: '#d8bb84',
    glass: '#bfe6ee',
    lampGlow: '#ffdf9b',
    stone: '#9aa39c',
    stoneDark: '#6f7a75',
  });

  /* --- structural pieces --------------------------------------------------- */

  /** A gabled roof: two sloped faces and two triangular ends, as one solid. */
  P.gableRoof = function (parent, width, depth, baseY, peakY, color) {
    var w = width / 2, d = depth / 2;
    return mesh(parent, poly(
      [[-w, baseY, -d], [w, baseY, -d], [0, peakY, -d],
       [-w, baseY, d], [w, baseY, d], [0, peakY, d]],
      [[0, 3, 5], [0, 5, 2], [2, 5, 4], [2, 4, 1], [0, 2, 1], [3, 4, 5]]
    ), color);
  };

  /** A framed window with a sill — pure decoration, but it sells scale. */
  P.window = function (parent, x, y, z, w, h, frameColor, glassColor) {
    w = w === undefined ? 0.18 : w;
    h = h === undefined ? 0.22 : h;
    box(parent, x, y, z, w + 0.052, h + 0.052, 0.035, frameColor || PAL.cream);
    box(parent, x, y, z + 0.023, w, h, 0.015, glassColor || '#70bdc8');
    box(parent, x, y, z + 0.038, 0.017, h, 0.015, frameColor || PAL.cream);
    box(parent, x, y, z + 0.038, w, 0.017, 0.015, frameColor || PAL.cream);
    return parent;
  };

  /** A plank door with a handle. */
  P.door = function (parent, x, y, z, w, h, color) {
    w = w || 0.24; h = h || 0.42;
    box(parent, x, y + h / 2, z, w, h, 0.04, color || PAL.woodDark);
    for (var i = 0; i < 3; i++) box(parent, x - w / 2 + w * (0.2 + i * 0.3), y + h / 2, z + 0.022, 0.012, h * 0.94, 0.01, '#5e4a38');
    sphere(parent, x + w * 0.32, y + h * 0.5, z + 0.035, 0.021, PAL.brass, 1);
    return parent;
  };

  /** A simple cottage: walls, gable roof, chimney with smoke, door, windows. */
  P.cottage = function (parent, opts) {
    opts = opts || {};
    var w = opts.width || 1.1, d = opts.depth || 0.95, h = opts.height || 0.62;
    var g = group(parent, opts.x || 0, 0, opts.z || 0, opts.scale || 1, opts.heading || 0);
    box(g, 0, h / 2, 0, w, h, d, opts.wall || PAL.cream);
    /* corner posts */
    for (var sx = -1; sx <= 1; sx += 2) {
      for (var sz = -1; sz <= 1; sz += 2) {
        box(g, (sx * w) / 2, h / 2, (sz * d) / 2, 0.055, h, 0.055, opts.trim || PAL.wood);
      }
    }
    P.gableRoof(g, w * 1.16, d * 1.16, h - 0.02, h + (opts.roofHeight || 0.42), opts.roof || PAL.roofRed);
    box(g, 0, h + 0.02, 0, w * 1.18, 0.05, d * 1.18, opts.trim || PAL.wood);
    P.door(g, 0, 0, d / 2 + 0.01, 0.24, 0.42, opts.doorColor);
    P.window(g, -w * 0.32, h * 0.62, d / 2 + 0.01, 0.16, 0.18, opts.trim || PAL.cream, opts.glass);
    P.window(g, w * 0.32, h * 0.62, d / 2 + 0.01, 0.16, 0.18, opts.trim || PAL.cream, opts.glass);
    if (opts.chimney !== false) {
      var cx = w * 0.3;
      box(g, cx, h + 0.3, -d * 0.2, 0.14, 0.42, 0.14, opts.chimneyColor || PAL.stone);
      box(g, cx, h + 0.52, -d * 0.2, 0.17, 0.05, 0.17, PAL.stoneDark);
      if (opts.smoke !== false) {
        TW.nature.smoke(g, cx, h + 0.58, -d * 0.2, { count: 5, rise: 1.3, size: 0.11, speed: 0.19 });
      }
    }
    return g;
  };

  /** A round yurt / tent shelter. */
  P.tent = function (parent, x, z, scale, canvasColor, trimColor) {
    var g = group(parent, x, 0, z, scale === undefined ? 1 : scale, rand(0, TAU));
    cone(g, 0, 0.22, 0, 0.5, 0.44, canvasColor || PAL.canvas, 8, 0.48);
    cone(g, 0, 0.62, 0, 0.52, 0.42, trimColor || PAL.roofBlue, 8, 0.06);
    torus(g, 0, 0.44, 0, 0.5, 0.022, PAL.rope, 8, true);
    box(g, 0, 0.16, 0.48, 0.2, 0.32, 0.03, PAL.woodDark);
    tube(g, 0, 0.86, 0, 0.012, 0.12, PAL.wood, 4);
    box(g, 0.05, 0.92, 0, 0.11, 0.07, 0.01, PAL.roofRed);
    return g;
  };

  /** A three-rail fence run between two local points. */
  P.fence = function (parent, from, to, opts) {
    opts = opts || {};
    var color = opts.color || PAL.wood;
    var height = opts.height || 0.4;
    var g = group(parent);
    var dx = to[0] - from[0], dz = to[1] - from[1];
    var len = Math.hypot(dx, dz);
    var n = Math.max(2, Math.round(len / (opts.spacing || 0.62)));
    for (var i = 0; i <= n; i++) {
      var k = i / n;
      var px = from[0] + dx * k, pz = from[1] + dz * k;
      box(g, px, height / 2, pz, 0.045, height, 0.045, color);
      if (i < n) {
        var qx = from[0] + dx * ((i + 1) / n), qz = from[1] + dz * ((i + 1) / n);
        for (var r = 0; r < (opts.rails || 2); r++) {
          var ry = height * (0.4 + r * 0.42);
          beam(g, [px, ry, pz], [qx, ry, qz], 0.028, opts.railColor || color, 0.035);
        }
      }
    }
    return g;
  };

  /** A hanging lantern on a post. `lit` state is driven from outside so the
   *  day/night cycle and the wonders can switch it. */
  P.lamppost = function (parent, x, z, height, opts) {
    opts = opts || {};
    height = height || 1.15;
    var g = group(parent, x, 0, z, 1, opts.heading || 0);
    tube(g, 0, 0.03, 0, 0.075, 0.06, PAL.stoneDark, 6);
    tube(g, 0, height / 2, 0, 0.032, height, opts.postColor || PAL.iron, 6);
    var arm = link(g, [0, height, 0], [0.16, height + 0.09, 0], 0.02, opts.postColor || PAL.iron, 5);
    var glassMat = mat(opts.glassColor || PAL.lampGlow, {
      emissive: opts.glassColor || PAL.lampGlow,
      emissiveIntensity: 0,
      transparent: true, opacity: 0.9, roughness: 0.3,
    });
    var lamp = group(g, 0.16, height - 0.03, 0);
    var glass = mesh(lamp, new T.CylinderGeometry(0.052, 0.062, 0.13, 6), glassMat, 0, 0, 0);
    glass.castShadow = false;
    cone(lamp, 0, 0.1, 0, 0.085, 0.08, opts.postColor || PAL.iron, 6, 0.02);
    tube(lamp, 0, -0.075, 0, 0.062, 0.02, opts.postColor || PAL.iron, 6);
    g.userData.glass = glassMat;
    g.userData.setLit = function (on, strength) {
      glassMat.emissiveIntensity = on ? (strength === undefined ? 1.7 : strength) : 0;
    };
    return g;
  };

  /** A string of bulbs sagging between two points. Returns a setLit handle. */
  P.stringLights = function (parent, from, to, count, color) {
    count = count || 7;
    color = color || '#ffd894';
    var g = group(parent);
    var bulbMat = mat(color, {
      emissive: color, emissiveIntensity: 0,
      transparent: true, opacity: 0.95, roughness: 0.35,
    });
    var sag = 0.28;
    var pts = [];
    for (var i = 0; i <= count; i++) {
      var k = i / count;
      pts.push([
        from[0] + (to[0] - from[0]) * k,
        from[1] + (to[1] - from[1]) * k - Math.sin(k * Math.PI) * sag,
        from[2] + (to[2] - from[2]) * k,
      ]);
    }
    for (var s = 0; s < pts.length - 1; s++) link(g, pts[s], pts[s + 1], 0.008, PAL.woodDark, 3);
    for (var b = 1; b < pts.length - 1; b++) {
      var bulb = sphere(g, pts[b][0], pts[b][1] - 0.05, pts[b][2], 0.036, bulbMat, 1);
      bulb.castShadow = false;
    }
    g.userData.setLit = function (on) { bulbMat.emissiveIntensity = on ? 2.1 : 0; };
    return g;
  };

  /* --- containers and clutter ---------------------------------------------- */

  P.crate = function (parent, x, y, z, size, color) {
    size = size || 0.26;
    var g = group(parent, x, y, z, 1, rand(0, TAU));
    box(g, 0, size / 2, 0, size, size, size, color || PAL.wood);
    for (var s = -1; s <= 1; s += 2) {
      box(g, 0, size / 2, (s * size) / 2 + s * 0.006, size * 1.02, size * 0.13, 0.012, PAL.woodDark);
      box(g, (s * size) / 2 + s * 0.006, size / 2, 0, 0.012, size * 0.13, size * 1.02, PAL.woodDark);
    }
    return g;
  };

  P.barrel = function (parent, x, y, z, scale, color) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, y, z, scale, rand(0, TAU));
    cone(g, 0, 0.18, 0, 0.15, 0.36, color || PAL.woodWarm, 10, 0.13);
    torus(g, 0, 0.08, 0, 0.147, 0.014, PAL.iron, 10, true);
    torus(g, 0, 0.28, 0, 0.14, 0.014, PAL.iron, 10, true);
    tube(g, 0, 0.365, 0, 0.13, 0.012, PAL.woodDark, 10);
    return g;
  };

  P.basket = function (parent, x, y, z, scale, contents) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, y, z, scale, rand(0, TAU));
    cone(g, 0, 0.09, 0, 0.13, 0.18, '#c99a5e', 9, 0.17);
    torus(g, 0, 0.18, 0, 0.168, 0.017, '#a97f47', 9, true);
    if (contents) {
      for (var i = 0; i < 6; i++) {
        var a = rand(0, TAU), r = rand(0, 0.1);
        sphere(g, Math.cos(a) * r, 0.19 + rand(0, 0.04), Math.sin(a) * r, rand(0.035, 0.05), contents, 1);
      }
    }
    return g;
  };

  P.sack = function (parent, x, y, z, scale, color) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, y, z, scale, rand(0, TAU));
    rock(g, 0, 0.13, 0, 0.14, 0.15, 0.13, color || '#ddc79a');
    tube(g, 0, 0.27, 0, 0.045, 0.06, color || '#ddc79a', 6);
    torus(g, 0, 0.26, 0, 0.05, 0.012, PAL.rope, 6, true);
    return g;
  };

  P.bench = function (parent, x, z, heading, color) {
    var g = group(parent, x, 0, z, 1, heading || 0);
    box(g, 0, 0.16, 0, 0.62, 0.045, 0.2, color || PAL.wood);
    box(g, 0, 0.32, -0.09, 0.62, 0.035, 0.16, color || PAL.wood).rotation.x = -0.22;
    for (var s = -1; s <= 1; s += 2) {
      box(g, s * 0.24, 0.08, 0.06, 0.045, 0.16, 0.045, PAL.woodDark);
      box(g, s * 0.24, 0.08, -0.07, 0.045, 0.16, 0.045, PAL.woodDark);
    }
    return g;
  };

  /** A stack of firewood. */
  P.woodpile = function (parent, x, z, scale) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, 0, z, scale, rand(0, TAU));
    for (var row = 0; row < 3; row++) {
      var n = 4 - row;
      for (var i = 0; i < n; i++) {
        var logMesh = tube(g, (i - (n - 1) / 2) * 0.11, 0.055 + row * 0.1, 0, 0.05, 0.44,
          row % 2 ? '#a97e51' : '#946c46', 7);
        logMesh.rotation.z = Math.PI / 2;
        tube(g, (i - (n - 1) / 2) * 0.11, 0.055 + row * 0.1, 0.222, 0.048, 0.01, '#e0c79b', 7)
          .rotation.z = Math.PI / 2;
      }
    }
    return g;
  };

  /* --- water craft and coastal --------------------------------------------- */

  /** A little sailing dinghy. Returns pivots so it can be animated. */
  P.sailboat = function (parent, x, y, z, scale, opts) {
    opts = opts || {};
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, y, z, scale);
    var hull = mesh(g, poly(
      [[-0.17, 0.09, -0.42], [0.17, 0.09, -0.42], [0.2, 0.09, 0.1], [0, 0.09, 0.52], [-0.2, 0.09, 0.1],
       [-0.13, -0.07, -0.34], [0.13, -0.07, -0.34], [0.14, -0.07, 0.08], [0, -0.05, 0.42], [-0.14, -0.07, 0.08]],
      [[0, 1, 2], [0, 2, 4], [2, 3, 4],
       [5, 7, 6], [5, 9, 7], [7, 9, 8],
       [0, 5, 6], [0, 6, 1], [1, 6, 7], [1, 7, 2], [2, 7, 8], [2, 8, 3],
       [3, 8, 9], [3, 9, 4], [4, 9, 5], [4, 5, 0]]
    ), opts.hull || '#e0684f');
    box(g, 0, 0.1, 0, 0.36, 0.02, 0.8, opts.deck || PAL.canvas);
    tube(g, 0, 0.52, -0.02, 0.018, 0.86, PAL.wood, 6);
    var sail = mesh(g, poly([[0, 0.92, -0.02], [0, 0.16, -0.02], [0.01, 0.2, 0.42]]),
      mat(opts.sail || '#fdf3dc', { side: T.DoubleSide }), 0, 0, 0);
    var jib = mesh(g, poly([[0, 0.86, -0.04], [0, 0.2, -0.04], [-0.01, 0.22, -0.36]]),
      mat(opts.jib || '#f4d8b0', { side: T.DoubleSide }), 0, 0, 0);
    link(g, [0, 0.94, -0.02], [0, 0.14, 0.5], 0.005, PAL.rope, 3);
    g.userData.sail = sail;
    g.userData.jib = jib;
    return g;
  };

  /** A plank jetty on stilts reaching out from shore. */
  P.jetty = function (parent, from, to, opts) {
    opts = opts || {};
    var g = group(parent);
    var dx = to[0] - from[0], dz = to[1] - from[1];
    var len = Math.hypot(dx, dz);
    var planks = Math.max(3, Math.round(len / 0.19));
    var width = opts.width || 0.62;
    var y = opts.height === undefined ? 0.24 : opts.height;
    var ang = Math.atan2(dx, dz);
    for (var i = 0; i <= planks; i++) {
      var k = i / planks;
      var px = from[0] + dx * k, pz = from[1] + dz * k;
      box(g, px, y, pz, width, 0.035, 0.14, i % 2 ? PAL.wood : '#b0854f', ang);
      if (i % 3 === 0) {
        for (var s = -1; s <= 1; s += 2) {
          var ox = Math.cos(ang) * s * width * 0.44;
          var oz = -Math.sin(ang) * s * width * 0.44;
          tube(g, px + ox, y / 2 - 0.04, pz + oz, 0.035, y + 0.08, PAL.woodDark, 6);
        }
      }
    }
    /* mooring post at the far end */
    tube(g, to[0], y + 0.1, to[1], 0.05, 0.42, PAL.woodDark, 7);
    torus(g, to[0], y + 0.26, to[1], 0.06, 0.012, PAL.rope, 8, true);
    return g;
  };

  /** A rope-and-plank suspension bridge between two local points. */
  P.ropeBridge = function (parent, from, to, opts) {
    opts = opts || {};
    var g = group(parent);
    var dx = to[0] - from[0], dz = to[1] - from[1];
    var len = Math.hypot(dx, dz);
    var n = Math.max(6, Math.round(len / 0.24));
    var sag = opts.sag === undefined ? 0.3 : opts.sag;
    var y = opts.height === undefined ? 0.16 : opts.height;
    var ang = Math.atan2(dx, dz);
    var half = (opts.width || 0.6) / 2;
    var ox = Math.cos(ang) * half, oz = -Math.sin(ang) * half;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var k = i / n;
      pts.push([from[0] + dx * k, y - Math.sin(k * Math.PI) * sag, from[1] + dz * k]);
    }
    for (var i2 = 0; i2 <= n; i2++) {
      box(g, pts[i2][0], pts[i2][1], pts[i2][2], half * 2, 0.03, 0.15, i2 % 2 ? PAL.wood : '#a87f4d', ang);
    }
    for (var s = -1; s <= 1; s += 2) {
      for (var j = 0; j < n; j++) {
        link(g, [pts[j][0] + ox * s, pts[j][1] + 0.02, pts[j][2] + oz * s],
          [pts[j + 1][0] + ox * s, pts[j + 1][1] + 0.02, pts[j + 1][2] + oz * s], 0.012, PAL.rope, 4);
        link(g, [pts[j][0] + ox * s, pts[j][1] + 0.45, pts[j][2] + oz * s],
          [pts[j + 1][0] + ox * s, pts[j + 1][1] + 0.45, pts[j + 1][2] + oz * s], 0.01, PAL.rope, 4);
        if (j % 2 === 0) {
          link(g, [pts[j][0] + ox * s, pts[j][1], pts[j][2] + oz * s],
            [pts[j][0] + ox * s, pts[j][1] + 0.45, pts[j][2] + oz * s], 0.006, PAL.rope, 3);
        }
      }
      tube(g, from[0] + ox * s, y + 0.24, from[1] + oz * s, 0.038, 0.56, PAL.woodDark, 6);
      tube(g, to[0] + ox * s, y + 0.24, to[1] + oz * s, 0.038, 0.56, PAL.woodDark, 6);
    }
    return g;
  };

  /* --- machinery ----------------------------------------------------------- */

  /** A four-sail windmill. Returns the sail pivot so a wonder can spin it. */
  P.windmill = function (parent, x, z, scale, opts) {
    opts = opts || {};
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, 0, z, scale, opts.heading || 0);
    cone(g, 0, 0.98, 0, 0.5, 1.96, opts.tower || PAL.cream, 8, 0.31);
    for (var b = 0; b < 4; b++) {
      torus(g, 0, 0.24 + b * 0.5, 0, 0.478 - b * 0.048, 0.019, opts.band || PAL.wood, 8, true);
    }
    P.door(g, 0, 0, 0.46, 0.24, 0.44, PAL.woodDark);
    P.window(g, 0, 1.0, 0.37, 0.14, 0.16, PAL.cream, PAL.glass);
    P.window(g, 0, 1.5, 0.33, 0.11, 0.13, PAL.cream, PAL.glass);
    /* a little balcony under the cap */
    torus(g, 0, 1.74, 0, 0.4, 0.03, PAL.wood, 10, true);
    cone(g, 0, 2.12, 0, 0.4, 0.4, opts.roof || PAL.roofBlue, 8, 0.06);
    /* sail assembly */
    var hub = pivot(g, 0, 1.86, 0.42);
    tube(hub, 0, 0, -0.03, 0.05, 0.12, PAL.iron, 8).rotation.x = Math.PI / 2;
    for (var i = 0; i < 4; i++) {
      var arm = group(hub, 0, 0, 0.03);
      arm.rotation.z = (i * Math.PI) / 2;
      box(arm, 0, 0.52, 0, 0.042, 1.04, 0.034, PAL.wood);
      for (var s = 0; s < 7; s++) {
        box(arm, 0.085, 0.18 + s * 0.135, 0.014, 0.14, 0.08, 0.013, opts.sail || '#f2e3c0');
      }
    }
    C.bake(hub, true);
    dyn(hub);
    g.userData.hub = hub;
    return g;
  };

  /** A hand water pump over a trough. */
  P.pump = function (parent, x, z, heading) {
    var g = group(parent, x, 0, z, 1, heading || 0);
    box(g, 0, 0.06, 0, 0.5, 0.12, 0.3, PAL.stone);
    box(g, 0, 0.14, 0, 0.42, 0.08, 0.22, '#5f9fa8');
    tube(g, -0.14, 0.3, 0, 0.05, 0.36, PAL.iron, 8);
    var spout = tube(g, -0.05, 0.44, 0, 0.028, 0.2, PAL.iron, 6);
    spout.rotation.z = Math.PI / 2;
    var handle = pivot(g, -0.14, 0.48, 0);
    box(handle, 0.11, 0.02, 0, 0.26, 0.03, 0.035, PAL.woodDark);
    sphere(handle, 0.23, 0.02, 0, 0.035, PAL.wood, 1);
    g.userData.handle = handle;
    return g;
  };

  /** A small hand cart with two wheels. */
  P.cart = function (parent, x, z, heading, color) {
    var g = group(parent, x, 0, z, 1, heading || 0);
    box(g, 0, 0.24, 0, 0.5, 0.03, 0.72, color || PAL.wood);
    for (var s = -1; s <= 1; s += 2) box(g, s * 0.25, 0.34, 0, 0.03, 0.2, 0.72, color || PAL.wood);
    box(g, 0, 0.34, -0.35, 0.5, 0.2, 0.03, color || PAL.wood);
    for (var w = -1; w <= 1; w += 2) {
      var wheel = torus(g, w * 0.29, 0.19, 0.05, 0.18, 0.035, PAL.woodDark, 12);
      wheel.rotation.y = Math.PI / 2;
      for (var k = 0; k < 6; k++) {
        var spoke = box(g, w * 0.29, 0.19, 0.05, 0.02, 0.34, 0.02, '#8f6a45');
        spoke.rotation.x = (k * Math.PI) / 6;
      }
    }
    link(g, [0.16, 0.26, 0.36], [0.13, 0.12, 0.66], 0.02, PAL.woodDark, 5);
    link(g, [-0.16, 0.26, 0.36], [-0.13, 0.12, 0.66], 0.02, PAL.woodDark, 5);
    return g;
  };

  /** A brass telescope on a tripod, aimable. */
  P.telescope = function (parent, x, z, heading) {
    var g = group(parent, x, 0, z, 1, heading || 0);
    for (var i = 0; i < 3; i++) {
      var a = (i * TAU) / 3;
      link(g, [Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22], [0, 0.44, 0], 0.022, PAL.woodDark, 5);
    }
    var yaw = pivot(g, 0, 0.46, 0);
    tube(yaw, 0, 0.02, 0, 0.05, 0.08, PAL.iron, 8);
    var pitch = pivot(yaw, 0, 0.08, 0);
    var barrel = cone(pitch, 0, 0, 0, 0.075, 0.52, PAL.brass, 10, 0.055);
    barrel.rotation.x = Math.PI / 2 - 0.6;
    torus(pitch, 0, 0.11, 0.16, 0.078, 0.016, '#8b6b34', 10).rotation.x = 0.6;
    cone(pitch, 0, -0.11, -0.17, 0.038, 0.08, '#2b3138', 8, 0.03).rotation.x = Math.PI / 2 - 0.6;
    g.userData.yaw = yaw;
    g.userData.pitch = pitch;
    return g;
  };

  /** A weather / research mast with a dish and blinking lamp. */
  P.mast = function (parent, x, z, height, opts) {
    opts = opts || {};
    height = height || 1.6;
    var g = group(parent, x, 0, z, 1, opts.heading || 0);
    box(g, 0, 0.04, 0, 0.42, 0.08, 0.42, PAL.iron);
    for (var s = 0; s < 4; s++) {
      var a = (s * TAU) / 4 + Math.PI / 4;
      link(g, [Math.cos(a) * 0.17, 0.06, Math.sin(a) * 0.17], [0, height, 0], 0.016, opts.color || '#b8c0c4', 4);
    }
    for (var r = 1; r <= 4; r++) {
      torus(g, 0, (height * r) / 5, 0, 0.17 * (1 - r / 6), 0.009, opts.color || '#b8c0c4', 4, true);
    }
    var dish = pivot(g, 0, height * 0.82, 0);
    var d = mesh(dish, new T.SphereGeometry(0.19, 10, 6, 0, TAU, 0, Math.PI / 2.4),
      mat(opts.dish || '#e6ebe4', { side: T.DoubleSide }), 0.14, 0, 0);
    d.rotation.z = -1.1;
    tube(dish, 0.22, 0.05, 0, 0.012, 0.14, PAL.iron, 4).rotation.z = -1.1;
    var lampMat = mat('#ff7a5c', { emissive: '#ff5a3c', emissiveIntensity: 0.4, roughness: 0.4 });
    var lamp = sphere(g, 0, height + 0.05, 0, 0.045, lampMat, 1);
    lamp.castShadow = false;
    dyn(g, function (t) {
      lampMat.emissiveIntensity = 0.35 + Math.abs(Math.sin(t * 2.2)) * 2.1;
    });
    g.userData.dish = dish;
    g.userData.lamp = lampMat;
    return g;
  };

  /** A campfire ring: stones, logs, and switchable flames. */
  P.campfire = function (parent, x, z, scale) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, 0, z, scale);
    for (var i = 0; i < 9; i++) {
      var a = (i / 9) * TAU;
      rock(g, Math.cos(a) * 0.34, 0.04, Math.sin(a) * 0.34, rand(0.08, 0.13), rand(0.06, 0.1), rand(0.08, 0.12),
        i % 2 ? '#8d938c' : '#767d78');
    }
    for (var l = 0; l < 4; l++) {
      var la = (l * TAU) / 4 + 0.4;
      var log = link(g, [Math.cos(la) * 0.2, 0.03, Math.sin(la) * 0.2],
        [Math.cos(la + 2.4) * 0.18, 0.24, Math.sin(la + 2.4) * 0.18], 0.035, '#7c5a3c', 5);
    }
    var emberMat = mat('#ff8a3c', { emissive: '#ff6a26', emissiveIntensity: 0, roughness: 0.6 });
    for (var e = 0; e < 5; e++) {
      var ea = rand(0, TAU), er = rand(0, 0.12);
      var ember = sphere(g, Math.cos(ea) * er, 0.035, Math.sin(ea) * er, rand(0.03, 0.05), emberMat, 0);
      ember.castShadow = false;
    }
    var flames = TW.nature.flames(g, 0, 0.1, 0, 1);
    flames.visible = false;
    var smoke = TW.nature.smoke(g, 0, 0.35, 0, { count: 5, rise: 1.6, size: 0.12, speed: 0.2 });
    smoke.visible = false;
    g.userData.flames = flames;
    g.userData.smoke = smoke;
    g.userData.embers = emberMat;
    g.userData.setLit = function (on) {
      flames.visible = on;
      smoke.visible = on;
      emberMat.emissiveIntensity = on ? 1.4 : 0;
    };
    return g;
  };

  /** A hanging bell in a timber frame. Returns the swing pivot. */
  P.bell = function (parent, x, z, scale, heading) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, 0, z, scale, heading || 0);
    for (var s = -1; s <= 1; s += 2) {
      link(g, [s * 0.3, 0, 0.14], [s * 0.17, 0.86, 0], 0.038, PAL.woodDark, 5);
      link(g, [s * 0.3, 0, -0.14], [s * 0.17, 0.86, 0], 0.038, PAL.woodDark, 5);
    }
    box(g, 0, 0.88, 0, 0.5, 0.05, 0.09, PAL.wood);
    var swing = pivot(g, 0, 0.86, 0);
    var body = mesh(swing, new T.CylinderGeometry(0.08, 0.19, 0.26, 10, 1, true),
      mat(PAL.brass, { side: T.DoubleSide, metalness: 0.35, roughness: 0.42 }), 0, -0.18, 0);
    tube(swing, 0, -0.045, 0, 0.03, 0.06, PAL.brass, 8);
    torus(swing, 0, -0.01, 0, 0.035, 0.011, PAL.iron, 8);
    tube(swing, 0, -0.36, 0, 0.02, 0.14, '#6a5a44', 6);
    sphere(swing, 0, -0.44, 0, 0.045, PAL.iron, 1);
    g.userData.swing = swing;
    return g;
  };

  /** A stone well with a bucket on a winch. */
  P.well = function (parent, x, z, scale) {
    scale = scale === undefined ? 1 : scale;
    var g = group(parent, x, 0, z, scale, rand(0, TAU));
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * TAU;
      box(g, Math.cos(a) * 0.34, 0.14, Math.sin(a) * 0.34, 0.17, 0.28, 0.15,
        i % 3 ? PAL.stone : PAL.stoneDark, -a);
    }
    torus(g, 0, 0.3, 0, 0.35, 0.03, PAL.stoneDark, 12, true);
    var water = mesh(g, new T.CircleGeometry(0.3, 14),
      mat('#3f8fa0', { transparent: true, opacity: 0.85, roughness: 0.2, metalness: 0.15 }), 0, 0.12, 0);
    water.geometry.rotateX(-Math.PI / 2);
    water.castShadow = false;
    for (var s = -1; s <= 1; s += 2) tube(g, s * 0.32, 0.55, 0, 0.032, 0.52, PAL.woodDark, 6);
    P.gableRoof(g, 0.9, 0.7, 0.78, 1.0, PAL.roofRed);
    var winch = pivot(g, 0, 0.7, 0);
    tube(winch, 0, 0, 0, 0.035, 0.6, PAL.wood, 8).rotation.z = Math.PI / 2;
    box(winch, 0.34, 0.09, 0, 0.03, 0.16, 0.03, PAL.woodDark);
    link(g, [0, 0.68, 0.06], [0, 0.36, 0.06], 0.006, PAL.rope, 3);
    cone(g, 0, 0.3, 0.06, 0.06, 0.1, PAL.woodWarm, 8, 0.07);
    g.userData.winch = winch;
    return g;
  };

  /* --- ground finishing ---------------------------------------------------- */

  /** Scattered flat stepping stones along a local polyline. */
  P.steppingStones = function (parent, points, color) {
    var g = group(parent);
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var s = rock(g, p[0], 0.02, p[1], rand(0.14, 0.22), 0.04, rand(0.14, 0.2), color || '#b6b0a0');
      s.rotation.x = 0;
      s.rotation.z = 0;
    }
    return g;
  };

  TW.props = P;
})(typeof window !== 'undefined' ? window : this);
