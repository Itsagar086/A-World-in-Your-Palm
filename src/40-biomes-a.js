/* =============================================================================
 * A World in Your Palm — 40-biomes-a.js
 * Cubbon Woods, Hesaraghatta Fields, Ramanagara Dunes, Ulsoor Bay.
 *
 * Each builder receives the planet's authoring context and plants its region in
 * flat local metres. `ctx.place(id, x, z, build)` handles the sphere; the
 * builder just decides what goes where, as if laying out a tabletop diorama.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = global.TW;
  var C = TW.core;
  var N = TW.nature;
  var P = TW.props;
  var PAL = P.palette;
  var group = C.group, pivot = C.pivot, mesh = C.mesh, box = C.box, rock = C.rock;
  var cone = C.cone, tube = C.tube, torus = C.torus, sphere = C.sphere;
  var link = C.link, beam = C.beam, poly = C.poly, ribbon = C.ribbon, slab = C.slab;
  var mat = C.mat, dyn = C.dyn, rand = C.rand, TAU = C.TAU;

  var B = (TW.biomes = { list: [] });
  B.buildAll = function (ctx) {
    for (var i = 0; i < B.list.length; i++) B.list[i](ctx);
  };

  /* =========================================================================
   * MOSSWOOD — the starting forest.
   * A campsite in a clearing, a treehouse in the canopy, a stream and a fall.
   * The wonder lights the whole camp.
   * ========================================================================= */
  B.list.push(function mosswood(ctx) {
    var id = 'mosswood';
    var at = function (x, z, build, opts) { return ctx.place(id, x, z, build, opts); };
    var treeLights = null;  /* filled in by the treehouse, switched by the camp */

    /* --- paths and stream -------------------------------------------------- */
    ctx.path(id, [[-4.4, 1.8], [-2.7, 1.3], [-1.4, 0.45], [0, 0], [0.7, 0.65], [1.3, 1.85], [3.8, 2.7]],
      0.64, '#b6ac73');
    ctx.path(id, [[-1.6, 0], [-2.0, -0.25], [-2.1, -0.8]], 0.72, '#c0b07c');
    ctx.path(id, [[1.15, -3.7], [1.7, -2.7], [1.7, -1.7], [2.15, -0.5], [2.4, 0.7], [2.1, 1.8], [2.9, 3], [3.7, 4.2]],
      0.68, '#3fb0a6', 0.05);
    ctx.path(id, [[1.19, -3.6], [1.76, -2.7], [1.76, -1.7], [2.22, -0.5], [2.47, 0.7], [2.18, 1.8], [2.97, 3], [3.74, 4.1]],
      0.13, '#8edbcb', 0.065);

    /* --- the treehouse ----------------------------------------------------- */
    at(-2.1, -2.0, function (g) {
      /* A fat trunk with a platform, a cabin and a ladder. */
      tube(g, 0, 1.05, 0, 0.29, 2.1, '#6f5138', 8);
      for (var r = 0; r < 5; r++) {
        var a = (r * TAU) / 5;
        link(g, [0, 1.5 + r * 0.12, 0],
          [Math.cos(a) * 1.05, 2.1 + Math.sin(r) * 0.3, Math.sin(a) * 1.05], 0.06, '#6f5138', 5, 0.03);
      }
      /* canopy */
      rock(g, 0, 2.75, 0, 1.35, 0.85, 1.3, '#367d52');
      rock(g, 0.75, 2.45, 0.4, 0.75, 0.55, 0.72, '#3f8c5c');
      rock(g, -0.68, 2.5, -0.42, 0.68, 0.5, 0.66, '#2f6f4a');
      rock(g, 0.1, 3.2, -0.3, 0.7, 0.45, 0.6, '#47996a');

      /* platform + cabin */
      var deck = group(g, 0, 1.5, 0);
      slab(deck, [[-0.85, -0.75], [0.85, -0.75], [0.95, 0.55], [-0.7, 0.85]], 0.06, '#b58a55', 0.05);
      for (var p = 0; p < 8; p++) {
        var pa = (p * TAU) / 8;
        tube(deck, Math.cos(pa) * 0.78, 0.22, Math.sin(pa) * 0.72, 0.022, 0.4, '#8b6a45', 5);
        if (p < 7) {
          beam(deck, [Math.cos(pa) * 0.78, 0.4, Math.sin(pa) * 0.72],
            [Math.cos(pa + TAU / 8) * 0.78, 0.4, Math.sin(pa + TAU / 8) * 0.72], 0.02, PAL.rope, 0.02);
        }
      }
      var cabin = group(deck, -0.1, 0.06, -0.1);
      box(cabin, 0, 0.32, 0, 0.86, 0.6, 0.74, '#e5d3ac');
      P.gableRoof(cabin, 1, 0.9, 0.6, 0.98, '#5f8f6a');
      P.window(cabin, 0, 0.36, 0.38, 0.2, 0.2, PAL.cream, PAL.glass);
      box(cabin, 0.46, 0.28, 0, 0.02, 0.34, 0.24, '#7d6244');

      /* ladder */
      for (var s = -1; s <= 1; s += 2) tube(g, s * 0.11, 0.76, 0.34, 0.022, 1.5, '#9a7448', 5);
      for (var rung = 0; rung < 7; rung++) {
        beam(g, [-0.11, 0.16 + rung * 0.2, 0.34], [0.11, 0.16 + rung * 0.2, 0.34], 0.02, '#b58a55', 0.02);
      }

      /* lanterns strung from the deck — switched on by the wonder */
      treeLights = P.stringLights(g, [-0.8, 1.62, 0.5], [-2.4, 0.9, 1.4], 6, '#ffd894');
      N.bird(g, 0, 3.4, 0, 1.4, '#f4efe0', 0.42);
    }, { heading: 0.12 });
    ctx.block(id, -2.1, -2.0, 1.02);

    /* --- waterfall bluff ---------------------------------------------------- */
    at(0.3, -3.85, function (g) {
      rock(g, -0.38, 0.96, -0.04, 1.0, 1.47, 0.82, '#87938a');
      rock(g, 0.4, 0.92, 0.03, 0.8, 1.72, 0.74, '#a7aaa0');
      cone(g, 0.3, 2.4, -0.07, 0.35, 0.53, '#dde4d6', 5);
      rock(g, -0.49, 1.77, -0.1, 0.38, 0.41, 0.37, '#d1d8ca');
      rock(g, 0.75, 0.3, 0.26, 0.47, 0.4, 0.54, '#82968c');
      N.waterfall(g,
        [[0.61, 1.37, 0.48], [0.65, 1.12, 0.51], [0.69, 0.72, 0.57], [0.72, 0.3, 0.62], [0.87, 0.09, 0.67]],
        [0.25, 0.25, 0.22, 0.24, 0.39], '#8addd4', 12);
      N.grass(g, -0.9, 0.7, '#6fae62', 1.2);
      N.grass(g, 1.1, -0.5, '#6fae62', 1.0);
    });
    ctx.block(id, 0.3, -3.85, 1.0);

    /* --- the camp (the wonder) ---------------------------------------------- */
    var camp = at(0.3, 1.25, function (g) {
      var fire = P.campfire(g, 0, 0, 1);
      /* a cooking tripod over the fire */
      for (var i = 0; i < 3; i++) {
        var a = (i * TAU) / 3 + 0.5;
        link(g, [Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34], [0, 0.72, 0], 0.018, '#6c5843', 4);
      }
      link(g, [0, 0.68, 0], [0, 0.46, 0], 0.006, PAL.rope, 3);
      var pot = cone(g, 0, 0.38, 0, 0.13, 0.17, '#4c5358', 8, 0.11);
      torus(g, 0, 0.46, 0, 0.12, 0.012, '#3a4045', 8, true);

      P.tent(g, -1.15, 0.55, 0.85, '#efe0bd', '#4e7fa0');
      P.tent(g, 1.2, 0.35, 0.72, '#e8ddc6', '#c07b56');
      P.woodpile(g, 0.95, -0.9, 0.9);
      P.crate(g, -1.5, 0, -0.55, 0.26, PAL.wood);
      P.barrel(g, 1.55, 0, -0.35, 0.85);
      P.bench(g, -0.15, -1.0, 0.15, '#a8804f');
      P.bench(g, 0.55, 0.95, Math.PI - 0.3, '#a8804f');

      /* three lamp posts around the clearing */
      var lamps = [
        P.lamppost(g, -1.9, -1.1, 1.1, {}),
        P.lamppost(g, 1.85, 1.15, 1.05, {}),
        P.lamppost(g, 0.1, 1.9, 1.15, {}),
      ];
      var fireflies = N.motes(g, {
        x: 0, y: 0.4, z: 0, count: 34, radius: 2.6, height: 1.5,
        size: 0.028, color: '#ffe08a', speed: 0.3,
      });
      fireflies.visible = false;

      var lit = false;
      g.userData.activate = function () {
        lit = !lit;
        fire.userData.setLit(lit);
        for (var i = 0; i < lamps.length; i++) lamps[i].userData.setLit(lit);
        fireflies.visible = lit;
        if (treeLights) treeLights.userData.setLit(lit);
        return lit
          ? 'The camp is awake. Lanterns, firelight, and a hundred little wings.'
          : 'The fire settles to embers. Cubbon Woods breathes out.';
      };
      g.userData.flames = fire;
    });

    ctx.wonder({
      id: 'mosswood-lanterns',
      biome: id,
      label: 'The camp lanterns',
      action: 'Light the camp',
      description: 'Wake a clearing in the pines with warm light.',
      x: 0.3, z: 1.25, radius: 2.3,
      activate: camp.userData.activate,
    });

    /* --- pond and reeds ------------------------------------------------------ */
    at(-3.3, 2.4, function (g) {
      N.pond(g, 0, 0, 1.15, '#4fb5b0', '#93a08f');
      N.reeds(g, 0.9, 0.6, 7, 1.1);
      N.reeds(g, -0.85, -0.75, 5, 0.9);
      N.reeds(g, 0.2, -1.1, 6, 1.0);
      N.critter(g, -1.5, 0.6, { body: '#d8cbb4', accent: '#c09a86', scale: 0.9 });
      N.butterfly(g, 0.6, 0.5, 1.2, '#f0a0c8', 0.8);
    });
    ctx.block(id, -3.3, 2.4, 1.1);

    /* --- forest furniture ---------------------------------------------------- */
    at(-1.42, 2.25, function (g) {
      N.broadleaf(g, 0, 0, 2.4, '#4f9a58', '#8b6544');
      /* a rope swing */
      link(g, [0.35, 1.5, 0.2], [0.35, 0.55, 0.2], 0.008, PAL.rope, 3);
      link(g, [0.62, 1.5, 0.2], [0.62, 0.55, 0.2], 0.008, PAL.rope, 3);
      box(g, 0.485, 0.53, 0.2, 0.36, 0.035, 0.14, '#b58a55');
    });
    ctx.block(id, -1.42, 2.25, 0.6);

    at(2.25, 0.85, function (g) {
      /* a small plank bridge over the stream */
      P.ropeBridge(g, [-0.9, 0], [0.9, 0], { width: 0.7, sag: 0.14, height: 0.22 });
    }, { heading: Math.PI / 2 - 0.22 });

    at(-3.48, 0.4, function (g) {
      N.signpost(g, 0, 0, 0.6, '#c9a86f');
      N.boulders(g, 0.7, 0.35, 0.8, '#8f978f');
    });

    at(3.35, -0.4, function (g) {
      /* a hollow stump den */
      cone(g, 0, 0.34, 0, 0.44, 0.7, '#7b5c3f', 9, 0.4);
      cone(g, 0, 0.66, 0, 0.34, 0.12, '#3b2c1e', 9, 0.34);
      N.mushroom(g, 0.5, 0.2, 0.9, '#d1685c');
      N.mushroom(g, 0.62, 0.42, 0.6, '#d1685c');
      N.grass(g, -0.5, -0.3, '#6fae62', 1.1);
      N.critter(g, -0.9, 0.5, { body: '#c99a68', accent: '#8e6b4a', tailColor: '#e8d6b8', scale: 0.8 });
    });
    ctx.block(id, 3.35, -0.4, 0.55);

    /* --- the ring of pines --------------------------------------------------- */
    var ring = [
      [-4.3, -0.7, 2.15], [-4.0, -2.2, 2.3], [-3.6, -3.5, 1.95], [-2.5, -4.25, 2.05],
      [-1.1, -4.65, 2.45], [1.4, -4.6, 1.6], [2.65, -3.8, 2.2], [3.2, -2.55, 1.65],
      [3.4, -1.2, 2.3], [4.05, 0.1, 1.85], [4.45, 1.75, 2.05], [3.6, 3.2, 1.65],
      [1.3, 3.55, 1.7], [0.1, 4.12, 2.18], [-1.6, 4.1, 1.8], [-3.0, 3.05, 2.05],
      [-3.95, 1.75, 1.65], [-3.1, -0.3, 1.55],
    ];
    var pineColors = ['#357b55', '#318e60', '#4b9868', '#266c4d'];
    ring.forEach(function (spec, i) {
      at(spec[0], spec[1], function (g) { N.pine(g, 0, 0, spec[2], pineColors[i % 4], 0); });
      ctx.block(id, spec[0], spec[1], 0.19);
    });

    /* --- undergrowth ---------------------------------------------------------- */
    var clumps = [[-3.4, 1], [-0.3, 3], [3.2, -2.4], [-3.6, -3], [1, -2.4], [2.7, 2.8]];
    for (var u = 0; u < 40; u++) {
      var c = clumps[u % 6];
      var ux = c[0] + ctx.rand(-0.5, 0.5);
      var uz = c[1] + ctx.rand(-0.45, 0.45);
      (function (ux, uz, u) {
        at(ux, uz, function (g) {
          if (u % 7 === 0) N.berryBush(g, 0, 0, ctx.rand(0.6, 0.95), '#d2465a');
          else if (u % 5 === 0) N.mushroom(g, 0, 0, ctx.rand(0.7, 1.2), u % 2 ? '#d1685c' : '#cf8f5a');
          else if (u % 3 === 0) N.bush(g, 0, 0, ctx.rand(0.6, 1.0), '#3f7c48');
          else N.flower(g, 0, 0, ['#e8c477', '#d8e6be', '#a29ccc'][u % 3], ctx.rand(0.7, 1.25));
        });
      })(ux, uz, u);
    }

    /* stones along the stream */
    for (var st = 0; st < 17; st++) {
      var a2 = st / 16;
      var sz = 1.45 + 1.5 * a2 + Math.sin(a2 * 7) * 0.4;
      var sx = -3.1 + a2 * 6.3;
      (function (sz, sx, st) {
        at(sz + (st % 2 ? 0.47 : -0.44), sx, function (g) {
          rock(g, 0, 0.06, 0, ctx.rand(0.06, 0.14), 0.065, ctx.rand(0.08, 0.18),
            st % 2 ? '#acc2aa' : '#88a99a');
        });
      })(sz, sx, st);
    }

    ctx.wisp(id, -4.6, -1.6);
    ctx.wisp(id, 2.9, 3.6);
  });

  /* =========================================================================
   * HONEYFIELD — the meadow farm.
   * Crop rows, a farmhouse, beehives, and a windmill that has stopped.
   * ========================================================================= */
  B.list.push(function honeyfield(ctx) {
    var id = 'honeyfield';
    var at = function (x, z, build, opts) { return ctx.place(id, x, z, build, opts); };

    ctx.path(id, [[-4.2, 2.6], [-2.4, 1.9], [-0.6, 1.5], [1.1, 1.25], [2.6, 1.7], [4.2, 2.9]], 0.7, '#cbb886');
    ctx.path(id, [[-0.6, 1.5], [-0.9, -0.3], [-1.3, -2.1], [-1.1, -3.9]], 0.6, '#c6b483');
    ctx.path(id, [[1.1, 1.25], [1.9, -0.4], [2.4, -2.2]], 0.55, '#c6b483');

    /* --- farmhouse and barn --------------------------------------------------- */
    at(-2.6, -0.6, function (g) {
      P.cottage(g, {
        width: 1.5, depth: 1.2, height: 0.78, roofHeight: 0.56,
        wall: '#f6e9cc', roof: '#d4614e', trim: '#b98a55', glass: '#8fd0d8',
      });
      P.window(g, -0.55, 0.5, -0.61, 0.16, 0.18, PAL.cream, PAL.glass);
      /* washing line */
      link(g, [0.9, 0.7, 0.3], [1.9, 0.55, 0.9], 0.008, PAL.rope, 3);
      for (var i = 0; i < 4; i++) {
        var k = 0.2 + i * 0.2;
        box(g, 0.9 + k, 0.66 - k * 0.14 - 0.1, 0.3 + k * 0.6, 0.16, 0.19, 0.01,
          ['#e8b0b8', '#a8c8e0', '#f0dfa8', '#c8e0b0'][i]);
      }
      tube(g, 1.9, 0.3, 0.9, 0.02, 0.6, '#9a7448', 5);
      N.flower(g, -0.95, 0.75, '#e88ea8', 1.1);
      N.flower(g, -0.7, 0.9, '#f0d071', 0.9);
      N.flower(g, 0.95, -0.7, '#e5e0f0', 1.0);
    }, { heading: -0.2 });
    ctx.block(id, -2.6, -0.6, 1.15);

    at(-2.5, 2.6, function (g) {
      /* the barn */
      box(g, 0, 0.55, 0, 1.6, 1.1, 1.3, '#c05748');
      box(g, 0, 0.55, 0.66, 1.62, 1.12, 0.05, '#a84a3d');
      P.gableRoof(g, 1.72, 1.42, 1.06, 1.78, '#e8dcc0');
      box(g, 0, 0.42, 0.68, 0.66, 0.84, 0.05, '#f2e6cc');
      box(g, -0.17, 0.42, 0.71, 0.05, 0.84, 0.02, '#c05748');
      box(g, 0.17, 0.42, 0.71, 0.05, 0.84, 0.02, '#c05748');
      /* hayloft door and pulley */
      box(g, 0, 1.28, 0.62, 0.34, 0.36, 0.05, '#f2e6cc');
      link(g, [0, 1.62, 0.62], [0, 1.62, 0.82], 0.02, '#8a6a48', 4).rotation.x = Math.PI / 2;
      torus(g, 0, 1.58, 0.8, 0.05, 0.012, PAL.iron, 8);
      link(g, [0, 1.56, 0.8], [0, 1.1, 0.8], 0.005, PAL.rope, 3);
      P.crate(g, 0.05, 0.92, 0.8, 0.2, PAL.wood);
      /* weather vane */
      tube(g, 0.6, 1.9, 0, 0.014, 0.3, PAL.iron, 4);
      var vane = pivot(g, 0.6, 2.06, 0);
      box(vane, -0.06, 0, 0, 0.16, 0.11, 0.01, '#3f474b');
      cone(vane, 0.11, 0, 0, 0.05, 0.1, '#3f474b', 4).rotation.z = -Math.PI / 2;
      dyn(vane, function (t) { vane.rotation.y = Math.sin(t * 0.4) * 0.7; });
      /* hay */
      for (var h = 0; h < 3; h++) {
        var bale = box(g, 1.15, 0.16 + h * 0.02, -0.5 + h * 0.36, 0.36, 0.32, 0.3, '#e3ca7e', ctx.rand(0, 0.5));
      }
    }, { heading: 0.35 });
    ctx.block(id, -2.5, 2.6, 1.25);

    /* --- the windmill (the wonder) -------------------------------------------- */
    var mill = at(1.6, -1.4, function (g) {
      var w = P.windmill(g, 0, 0, 1.05, { heading: -0.5, roof: '#4e7fa0', tower: '#f4e8ce' });
      /* beehives at the foot */
      var hives = [];
      for (var i = 0; i < 3; i++) {
        var hx = 1.35 + i * 0.05, hz = 0.8 + i * 0.55;
        var hive = group(g, hx, 0, hz, 1, ctx.rand(0, TAU));
        box(hive, 0, 0.04, 0, 0.34, 0.08, 0.3, '#8a6a48');
        for (var b2 = 0; b2 < 3; b2++) {
          box(hive, 0, 0.14 + b2 * 0.14, 0, 0.3 - b2 * 0.015, 0.13, 0.26 - b2 * 0.013,
            b2 % 2 ? '#f0d99c' : '#e6c680');
        }
        P.gableRoof(hive, 0.36, 0.32, 0.52, 0.68, '#c9784f');
        hives.push(hive);
      }
      var bees = N.motes(g, {
        x: 1.5, y: 0.5, z: 1.35, count: 20, radius: 1.0, height: 0.8,
        size: 0.022, color: '#ffd24a', speed: 1.4, glow: 1.1,
      });
      bees.visible = false;

      /* flowerbeds that "bloom" when the mill turns */
      var blooms = [];
      for (var f = 0; f < 22; f++) {
        var a = (f / 22) * TAU;
        var r = 1.9 + ctx.rand(-0.3, 0.5);
        var fl = N.flower(g, Math.cos(a) * r, Math.sin(a) * r,
          ['#f0d071', '#e88ea8', '#e5e0f0', '#f2a25c'][f % 4], 0.55);
        C.bake(fl);
        fl.userData.dynamic = true;
        blooms.push(fl);
      }

      var running = false;
      var spin = 0;
      dyn(w.userData.hub, function () {});
      ctx.tick(function (t) {
        spin = C.damp(spin, running ? 1 : 0, 1.2, 1 / 60);
        w.userData.hub.rotation.z -= spin * 0.028;
        for (var i2 = 0; i2 < blooms.length; i2++) {
          var target = running ? 1 : 0.55;
          blooms[i2].scale.setScalar(C.damp(blooms[i2].scale.x, target, 3, 1 / 60) +
            (running ? Math.sin(t * 2 + i2) * 0.02 : 0));
        }
      });

      g.userData.activate = function () {
        running = !running;
        bees.visible = running;
        return running
          ? 'The sails catch. The whole field leans in to listen.'
          : 'The mill winds down, and the bees go home.';
      };
    });
    ctx.block(id, 1.6, -1.4, 1.15);

    ctx.wonder({
      id: 'honeyfield-windmill',
      biome: id,
      label: 'The stopped windmill',
      action: 'Start the windmill',
      description: 'Give the sails a push and watch the meadow answer.',
      x: 1.6, z: -1.4, radius: 2.35,
      activate: mill.userData.activate,
    });

    /* --- crop rows ------------------------------------------------------------ */
    for (var row = 0; row < 7; row++) {
      var rz = -2.2 + row * 0.5;
      (function (rz, row) {
        at(-1.0, rz, function (g) {
          ribbon(g, [[-1.5, 0.02, 0], [1.5, 0.02, 0]], 0.36, row % 2 ? '#8f7550' : '#9c8158');
          for (var c2 = 0; c2 < 9; c2++) {
            var px = -1.35 + c2 * 0.34;
            if (row % 3 === 0) {
              /* leafy greens */
              rock(g, px, 0.1, 0, 0.11, 0.09, 0.11, '#5fa059', true);
              rock(g, px + 0.04, 0.16, 0.03, 0.07, 0.06, 0.07, '#6fb066', true);
            } else if (row % 3 === 1) {
              /* corn */
              tube(g, px, 0.28, 0, 0.018, 0.56, '#8fae52', 4);
              for (var lf = 0; lf < 3; lf++) {
                var leaf = box(g, px + (lf % 2 ? 0.07 : -0.07), 0.3 + lf * 0.12, 0, 0.15, 0.03, 0.05, '#7ba44a');
                leaf.rotation.z = lf % 2 ? -0.5 : 0.5;
              }
              cone(g, px, 0.62, 0, 0.03, 0.12, '#e8cf7a', 5, 0.02);
            } else {
              /* root vegetables with tops */
              N.grass(g, px, 0, '#77a84e', 0.75, 0);
              sphere(g, px, 0.04, 0.05, 0.05, '#e08a4a', 1);
            }
          }
        });
      })(rz, row);
    }

    /* --- scarecrow, well, cart, fences ---------------------------------------- */
    at(-1.05, -2.9, function (g) {
      tube(g, 0, 0.5, 0, 0.03, 1.0, '#9a7448', 5);
      beam(g, [-0.42, 0.8, 0], [0.42, 0.8, 0], 0.035, '#9a7448', 0.035);
      box(g, 0, 0.66, 0, 0.44, 0.42, 0.2, '#c9784f');
      sphere(g, 0, 1.03, 0, 0.16, '#e3ca7e', 1);
      cone(g, 0, 1.16, 0, 0.3, 0.14, '#b8905a', 9, 0.16);
      torus(g, 0, 1.1, 0, 0.19, 0.02, '#8a6a48', 9, true);
      box(g, -0.05, 1.05, 0.14, 0.03, 0.03, 0.02, '#2b2f33');
      box(g, 0.05, 1.05, 0.14, 0.03, 0.03, 0.02, '#2b2f33');
      for (var s = 0; s < 5; s++) {
        var sa = ctx.rand(0, TAU);
        link(g, [Math.cos(sa) * 0.4, 0.8, Math.sin(sa) * 0.1],
          [Math.cos(sa) * 0.5, 0.7, Math.sin(sa) * 0.16], 0.012, '#e3ca7e', 3);
      }
      N.bird(g, 0.7, 1.3, 0.2, 0.5, '#3f474b', 0.8);
    }, { heading: 0.4 });

    at(3.0, 1.0, function (g) {
      P.well(g, 0, 0, 1);
      P.basket(g, 0.7, 0, 0.5, 1, '#e08a4a');
      P.sack(g, -0.65, 0, 0.55, 1, '#ddc79a');
    });
    ctx.block(id, 3.0, 1.0, 0.7);

    at(0.2, 2.6, function (g) {
      P.cart(g, 0, 0, 0.5, PAL.wood);
      P.crate(g, 0.7, 0, 0.3, 0.24, '#b58a55');
      P.sack(g, 0.05, 0.26, -0.1, 0.9, '#e3ca7e');
    });
    ctx.block(id, 0.2, 2.6, 0.55);

    at(0, 0, function (g) {
      P.fence(g, [-3.6, 3.9], [3.6, 3.9], { height: 0.42 });
      P.fence(g, [3.6, 3.9], [4.1, 0.2], { height: 0.42 });
      P.fence(g, [-4.0, 0.5], [-3.6, 3.9], { height: 0.42 });
      P.fence(g, [-3.2, -3.4], [1.0, -4.1], { height: 0.42 });
    });

    /* --- sheep ---------------------------------------------------------------- */
    var flock = [[-3.4, 1.2], [-3.0, 1.7], [-3.7, 2.0], [2.9, -2.4], [3.4, -2.0], [-0.4, 3.4]];
    flock.forEach(function (s, i) {
      at(s[0], s[1], function (g) {
        N.critter(g, 0, 0, {
          body: '#f4efe2', accent: '#3f3a36', tailColor: '#f4efe2',
          scale: 1.05, ears: false, heading: i * 1.1,
        });
      });
    });

    ctx.wisp(id, -4.3, -2.6);
    ctx.wisp(id, 3.9, 3.4);
  });

  /* =========================================================================
   * AMBER DUNES — the desert.
   * A caravan camp, a ruined arch, and a sunstone dial that remembers water.
   * ========================================================================= */
  B.list.push(function amberdunes(ctx) {
    var id = 'amberdunes';
    var at = function (x, z, build, opts) { return ctx.place(id, x, z, build, opts); };

    ctx.path(id, [[-4.4, -2.6], [-2.6, -1.6], [-1.0, -0.9], [0.6, -0.2], [2.0, 0.9], [3.6, 2.6]], 0.8, '#e0c288');
    ctx.path(id, [[0.6, -0.2], [1.2, 1.4], [1.1, 3.2]], 0.62, '#dcbd82');

    /* --- ruined arch ---------------------------------------------------------- */
    at(-2.2, 1.4, function (g) {
      for (var s = -1; s <= 1; s += 2) {
        for (var b = 0; b < 5; b++) {
          box(g, s * 0.85, 0.2 + b * 0.4, 0, 0.42 - b * 0.02, 0.4, 0.4,
            b % 2 ? '#d3b98c' : '#c7ac7e', ctx.rand(-0.05, 0.05));
        }
      }
      /* the span, as a fan of wedges */
      for (var w = 0; w < 7; w++) {
        var a = Math.PI * (0.08 + (w / 6) * 0.84);
        var bx = -Math.cos(a) * 0.85;
        var by = 2.0 + Math.sin(a) * 0.5;
        var blk = box(g, bx, by, 0, 0.34, 0.36, 0.4, w % 2 ? '#d3b98c' : '#c7ac7e');
        blk.rotation.z = a - Math.PI / 2;
      }
      /* fallen blocks */
      box(g, 1.5, 0.14, 0.5, 0.38, 0.28, 0.36, '#c7ac7e', 0.6);
      box(g, 1.85, 0.1, 0.15, 0.3, 0.2, 0.3, '#d3b98c', 1.1);
      rock(g, -1.6, 0.1, -0.4, 0.28, 0.2, 0.24, '#bda172');
      N.snag(g, 1.2, -1.1, 1.0, '#b2895b');
    }, { heading: 0.3 });
    ctx.block(id, -2.2, 1.4, 1.0);

    /* --- caravan camp --------------------------------------------------------- */
    at(-1.5, -2.3, function (g) {
      P.tent(g, 0, 0, 1.05, '#e8d5ab', '#b8674e');
      P.tent(g, 1.5, 0.5, 0.85, '#e0cba0', '#5f7f8f');
      /* an awning on poles */
      for (var s = -1; s <= 1; s += 2) {
        for (var t2 = -1; t2 <= 1; t2 += 2) {
          tube(g, -1.4 + (s > 0 ? 1.0 : 0), 0.36, t2 * 0.55, 0.02, 0.72, '#9a7448', 5);
        }
      }
      var awn = box(g, -0.9, 0.74, 0, 1.1, 0.03, 1.2, '#dcc08a');
      awn.rotation.x = 0.06;
      P.crate(g, -1.5, 0, 0.9, 0.24, '#b8905a');
      P.barrel(g, -0.4, 0, 1.0, 0.8, '#c9974f');
      P.basket(g, -1.1, 0, -0.9, 1.0, '#c0603f');
      /* a rug */
      ribbon(g, [[-1.5, 0.02, -0.3], [-0.4, 0.02, -0.45]], 0.7, '#b5563f');
      /* an unlit fire pit */
      for (var i = 0; i < 8; i++) {
        var a2 = (i / 8) * TAU;
        rock(g, 0.7 + Math.cos(a2) * 0.3, 0.03, -0.9 + Math.sin(a2) * 0.3, 0.09, 0.06, 0.09, '#a08a6c');
      }
      N.critter(g, 2.2, -0.6, { body: '#e0b177', accent: '#c48f54', tailColor: '#f0dcbc', scale: 0.85 });
    }, { heading: -0.4 });
    ctx.block(id, -1.5, -2.3, 1.2);

    /* --- the sunstone dial (the wonder) --------------------------------------- */
    var dial = at(1.5, 1.6, function (g) {
      /* a stepped stone plinth */
      for (var s = 0; s < 3; s++) {
        cone(g, 0, 0.08 + s * 0.14, 0, 0.95 - s * 0.16, 0.16, s % 2 ? '#cbb083' : '#bd9f70', 10, 0.9 - s * 0.16);
      }
      tube(g, 0, 0.62, 0, 0.13, 0.5, '#b89a6b', 8);
      /* the gnomon and the ring */
      var crystalMat = mat('#f2c46a', {
        emissive: '#e8a63a', emissiveIntensity: 0.25, roughness: 0.28, metalness: 0.12,
      });
      var spinner = pivot(g, 0, 0.9, 0);
      var shard = mesh(spinner, new T.OctahedronGeometry(0.3), crystalMat, 0, 0.22, 0);
      shard.scale.set(0.62, 1.5, 0.62);
      var ringA = torus(spinner, 0, 0.22, 0, 0.46, 0.026, '#c8a35e', 20);
      var ringB = torus(spinner, 0, 0.22, 0, 0.38, 0.02, '#d9b878', 20);
      ringB.rotation.y = Math.PI / 2;
      for (var m2 = 0; m2 < 12; m2++) {
        var ma = (m2 * TAU) / 12;
        box(g, Math.cos(ma) * 1.15, 0.05, Math.sin(ma) * 1.15, 0.09, 0.1, 0.16, '#b89a6b', -ma);
      }

      /* the spring: hidden until woken */
      var oasis = group(g, 2.6, 0, 1.3);
      oasis.scale.setScalar(0.01);
      oasis.userData.dynamic = true;
      N.pond(oasis, 0, 0, 1.25, '#3fb1b8', '#b09a72');
      N.palm(oasis, 1.0, 0.7, 2.0, 0.4);
      N.palm(oasis, -0.9, -0.8, 1.7, 2.2);
      N.palm(oasis, 0.2, -1.25, 1.5, 4.0);
      N.reeds(oasis, 1.15, -0.5, 6, 1.0);
      N.grass(oasis, -1.2, 0.6, '#6fa85e', 1.2);
      N.flower(oasis, 1.3, 0.1, '#e88ea8', 1.0);
      N.butterfly(oasis, 0, 0.8, 0, '#f0c8a0', 1.1);
      C.bake(oasis, true);

      var awake = false;
      ctx.tick(function (t) {
        spinner.rotation.y = t * (awake ? 0.85 : 0.12);
        shard.position.y = 0.22 + Math.sin(t * 1.6) * (awake ? 0.09 : 0.03);
        crystalMat.emissiveIntensity = C.damp(crystalMat.emissiveIntensity, awake ? 2.3 : 0.25, 2, 1 / 60);
        var target = awake ? 1 : 0.01;
        var s2 = C.damp(oasis.scale.x, target, 2.2, 1 / 60);
        oasis.scale.setScalar(s2);
        oasis.visible = s2 > 0.03;
      });

      g.userData.activate = function () {
        awake = !awake;
        return awake
          ? 'Water finds its old path. The dunes remember being green.'
          : 'The spring folds itself away, patient as ever.';
      };
    });
    ctx.block(id, 1.5, 1.6, 1.15);

    ctx.wonder({
      id: 'amberdunes-dial',
      biome: id,
      label: 'The sunstone dial',
      action: 'Turn the dial',
      description: 'Wake the spring that sleeps beneath the sand.',
      x: 1.5, z: 1.6, radius: 2.25,
      activate: dial.userData.activate,
    });

    /* --- cacti, bones, dunes -------------------------------------------------- */
    var cacti = [[-3.5, 0.2], [-3.0, -0.9], [3.2, -1.6], [2.4, -2.9], [-0.5, 3.3], [3.9, 0.8], [-4.1, 2.2]];
    cacti.forEach(function (c, i) {
      at(c[0], c[1], function (g) {
        var h = ctx.rand(0.9, 1.5);
        cone(g, 0, h / 2, 0, 0.17, h, '#5f9464', 8, 0.15);
        sphere(g, 0, h, 0, 0.15, '#5f9464', 1);
        for (var arm = 0; arm < 2; arm++) {
          var s = arm ? 1 : -1;
          if (i % 3 === arm) continue;
          var ay = h * ctx.rand(0.4, 0.6);
          tube(g, s * 0.22, ay, 0, 0.09, 0.3, '#548a5b', 7).rotation.z = Math.PI / 2;
          tube(g, s * 0.34, ay + 0.24, 0, 0.09, 0.42, '#548a5b', 7);
          sphere(g, s * 0.34, ay + 0.45, 0, 0.085, '#548a5b', 1);
        }
        for (var f = 0; f < 4; f++) {
          var fa = ctx.rand(0, TAU);
          sphere(g, Math.cos(fa) * 0.16, h * ctx.rand(0.7, 1.0), Math.sin(fa) * 0.16, 0.04, '#e8768c', 1);
        }
      });
      ctx.block(id, c[0], c[1], 0.28);
    });

    at(2.9, -0.4, function (g) {
      /* sun-bleached bones */
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * TAU;
        var rib = link(g, [Math.cos(a) * 0.05, 0.03, -0.5 + i * 0.18],
          [Math.cos(a) * 0.42, 0.32, -0.45 + i * 0.18], 0.028, '#eee3cb', 5);
      }
      link(g, [0, 0.05, -0.6], [0, 0.05, 0.55], 0.035, '#e8dcc0', 6);
      rock(g, 0, 0.14, 0.72, 0.2, 0.16, 0.24, '#f0e6d0');
      rock(g, 0, 0.14, 0.72, 0.06, 0.1, 0.1, '#c9bda2');
    });

    /* windswept ripples */
    for (var d = 0; d < 26; d++) {
      var da = (d / 26) * TAU;
      var dr = 3.0 + Math.sin(d * 2.3) * 1.4;
      (function (da, dr, d) {
        at(Math.cos(da) * dr, Math.sin(da) * dr, function (g) {
          ribbon(g, [[-0.7, 0.02, 0], [0, 0.03, 0.12], [0.7, 0.02, 0.05]], 0.26,
            d % 2 ? '#eccd92' : '#e2c084');
        }, { heading: da });
      })(da, dr, d);
    }

    ctx.wisp(id, -3.8, 3.2);
    ctx.wisp(id, 4.2, -2.8);
  });

  /* =========================================================================
   * DRIFTWOOD BAY — the coast.
   * Stilt huts, a jetty, a becalmed boat, and a bell that calls it home.
   * ========================================================================= */
  B.list.push(function driftbay(ctx) {
    var id = 'driftbay';
    var at = function (x, z, build, opts) { return ctx.place(id, x, z, build, opts); };

    ctx.path(id, [[-4.0, -2.6], [-2.6, -1.5], [-1.2, -0.6], [0.2, 0.2], [1.4, 1.4]], 0.72, '#e6d3a2');
    ctx.path(id, [[-1.2, -0.6], [-1.6, 1.2], [-1.9, 3.0]], 0.6, '#e2cd98');

    /* --- stilt huts ------------------------------------------------------------ */
    [[-2.4, 0.6, 0.3], [-3.2, 2.0, -0.5]].forEach(function (h, i) {
      at(h[0], h[1], function (g) {
        var deckY = 0.5;
        for (var sx = -1; sx <= 1; sx += 2) {
          for (var sz = -1; sz <= 1; sz += 2) {
            tube(g, sx * 0.5, deckY / 2, sz * 0.44, 0.045, deckY + 0.1, '#8a6a48', 6);
          }
        }
        box(g, 0, deckY, 0, 1.24, 0.05, 1.1, '#c49a5e');
        box(g, 0, deckY + 0.36, -0.1, 1.0, 0.66, 0.86, i ? '#eadfc4' : '#f2e6cc');
        P.gableRoof(g, 1.24, 1.1, deckY + 0.68, deckY + 1.08, i ? '#5f8f8a' : '#c9784f');
        P.door(g, 0, deckY, 0.34, 0.22, 0.4, '#8a6a48');
        P.window(g, -0.34, deckY + 0.46, 0.34, 0.15, 0.16, PAL.cream, PAL.glass);
        /* ladder down to the sand */
        for (var s = -1; s <= 1; s += 2) tube(g, s * 0.1, deckY / 2, 0.62, 0.018, deckY, '#9a7448', 5);
        for (var r = 0; r < 3; r++) {
          beam(g, [-0.1, 0.12 + r * 0.16, 0.62], [0.1, 0.12 + r * 0.16, 0.62], 0.016, '#b58a55', 0.016);
        }
        /* nets and floats */
        for (var n = 0; n < 5; n++) {
          sphere(g, 0.55, deckY + 0.14 + n * 0.09, 0.4, 0.045, n % 2 ? '#e08a4a' : '#5f9fa8', 1);
        }
        N.bird(g, 0, deckY + 1.4, 0, 0.9, '#f6f2e6', 0.6);
      }, { heading: h[2] });
      ctx.block(id, h[0], h[1], 0.85);
    });

    /* --- the harbour bell (the wonder) ------------------------------------------ */
    var harbour = at(1.9, 1.5, function (g) {
      /* a stone mole with the bell on the end */
      slab(g, [[-0.9, -0.7], [0.9, -0.7], [1.0, 0.7], [-0.8, 0.8]], 0.18, '#c2b79c', 0.16);
      for (var i = 0; i < 10; i++) {
        var a = (i / 10) * TAU;
        rock(g, Math.cos(a) * 1.0, 0.06, Math.sin(a) * 0.85, 0.16, 0.14, 0.16, '#a9a08a');
      }
      var bell = P.bell(g, 0, 0.18, 1.0, 0.2);
      P.crate(g, -0.6, 0.18, 0.35, 0.22, '#b58a55');
      P.barrel(g, 0.55, 0.18, -0.4, 0.75);

      /* the boat that goes out and comes home */
      var boatPath = pivot(g, 2.6, -0.05, -1.2);
      var boat = P.sailboat(boatPath, 0, 0, 0, 0.85, { hull: '#e0684f', sail: '#fdf3dc' });
      var wake = mesh(boatPath, new T.RingGeometry(0.32, 0.5, 18),
        mat('#dff3ee', { transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide }),
        0, 0.02, -0.1);
      wake.geometry.rotateX(-Math.PI / 2);
      wake.castShadow = false;

      var sailing = false;
      var journey = 0;
      var swingT = 0;
      ctx.tick(function (t) {
        var dt = 1 / 60;
        swingT = Math.max(0, swingT - dt);
        bell.userData.swing.rotation.x = Math.sin(swingT * 14) * swingT * 0.5;
        if (sailing) journey = Math.min(1, journey + dt * 0.09);
        else journey = Math.max(0, journey - dt * 0.14);
        var e = journey;
        var ang = e * TAU;
        var r = 2.6 + e * 1.4;
        boatPath.position.set(Math.cos(ang - 0.4) * r * 0.9, -0.05, Math.sin(ang - 0.4) * r * 0.55 - 0.4);
        boatPath.rotation.y = -ang + Math.PI * 0.5;
        boat.rotation.z = Math.sin(t * 1.4) * 0.06;
        boat.position.y = Math.sin(t * 1.1) * 0.04;
        wake.material.opacity = 0.12 + journey * 0.3;
        boatPath.visible = journey > 0.005;
      });

      g.userData.activate = function () {
        sailing = !sailing;
        swingT = 1.1;
        return sailing
          ? 'Ding. The little boat casts off and takes the long way round the bay.'
          : 'Ding. The boat turns for home, in no particular hurry.';
      };
    });
    ctx.block(id, 1.9, 1.5, 0.95);

    ctx.wonder({
      id: 'driftbay-bell',
      biome: id,
      label: 'The harbour bell',
      action: 'Ring the bell',
      description: 'Send the little boat out around the cove.',
      x: 1.9, z: 1.5, radius: 2.3,
      activate: harbour.userData.activate,
    });

    /* --- jetty and beached boat ------------------------------------------------- */
    at(1.2, -1.4, function (g) {
      P.jetty(g, [-1.0, 0], [1.9, 0.5], { width: 0.66, height: 0.3 });
      P.crate(g, -1.1, 0.3, 0.3, 0.22, '#b58a55');
    });

    at(-0.4, 2.6, function (g) {
      var boat = P.sailboat(g, 0, 0.08, 0, 1.0, { hull: '#4e8f9c', sail: '#f4e6c8' });
      boat.rotation.set(0.12, 0.7, 0.24);
      P.barrel(g, 0.9, 0, 0.5, 0.8);
      /* driftwood */
      for (var i = 0; i < 5; i++) {
        var a = ctx.rand(0, TAU);
        link(g, [Math.cos(a) * 1.1 - 0.4, 0.06, Math.sin(a) * 1.1 + 0.6],
          [Math.cos(a) * 1.6 - 0.4, 0.09, Math.sin(a) * 1.5 + 0.6], 0.05, '#cbbba0', 5, 0.035);
      }
    });
    ctx.block(id, -0.4, 2.6, 0.7);

    /* --- beach clutter ----------------------------------------------------------- */
    at(0.4, -2.6, function (g) {
      /* umbrella and towel */
      tube(g, 0, 0.5, 0, 0.018, 1.0, '#e0d6bc', 5).rotation.z = 0.12;
      var canopy = cone(g, 0.06, 1.02, 0, 0.72, 0.24, '#e2705f', 10, 0.04);
      canopy.rotation.z = 0.12;
      for (var i = 0; i < 5; i++) {
        var seg = cone(g, 0.06, 1.02, 0, 0.72, 0.245, '#f7ead0', 10, 0.04);
        seg.rotation.set(0, (i * TAU) / 10, 0.12);
        seg.scale.set(0.34, 1, 0.34);
      }
      ribbon(g, [[-0.9, 0.02, 0.7], [0.1, 0.02, 0.85]], 0.62, '#f0c8a0');
      P.basket(g, 0.7, 0, 0.6, 0.9, '#e8b06a');
      /* a small crab */
      var crab = N.critter(g, -1.0, -0.6, {
        body: '#e2705f', accent: '#c04a3c', scale: 0.5, ears: false, tail: false,
      });
    });

    /* shells and starfish scattered along the tideline */
    for (var s2 = 0; s2 < 30; s2++) {
      var k = s2 / 29;
      var sx = 2.2 + Math.sin(k * 6) * 0.5;
      var sz = -3.6 + k * 7.2;
      (function (sx, sz, s2) {
        at(sx, sz, function (g) {
          if (s2 % 5 === 0) {
            /* starfish */
            for (var arm = 0; arm < 5; arm++) {
              var a = (arm * TAU) / 5;
              var lobe = box(g, Math.cos(a) * 0.09, 0.02, Math.sin(a) * 0.09, 0.06, 0.03, 0.14, '#e88a6a', -a);
            }
            sphere(g, 0, 0.03, 0, 0.05, '#f2a284', 1);
          } else if (s2 % 3 === 0) {
            var shell = cone(g, 0, 0.04, 0, 0.09, 0.11, s2 % 2 ? '#f4e2cc' : '#eecfc0', 7, 0.01);
            shell.rotation.set(1.4, ctx.rand(0, TAU), 0);
          } else {
            rock(g, 0, 0.015, 0, ctx.rand(0.05, 0.1), 0.03, ctx.rand(0.05, 0.09), '#efdfbe');
          }
        });
      })(sx, sz, s2);
    }

    /* palms along the back of the beach */
    var palms = [[-3.4, -1.2], [-3.9, 0.4], [-3.5, 3.2], [-2.6, 3.9], [-1.0, 4.1], [0.6, 3.9], [-4.2, -2.4]];
    palms.forEach(function (p, i) {
      at(p[0], p[1], function (g) { N.palm(g, 0, 0, ctx.rand(1.7, 2.5), i * 1.3); });
      ctx.block(id, p[0], p[1], 0.22);
    });

    ctx.wisp(id, -4.4, 1.4);
    ctx.wisp(id, 2.6, 3.8);
  });
})(typeof window !== 'undefined' ? window : this);
