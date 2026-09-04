/* =============================================================================
 * Tiny World — 41-biomes-b.js
 * Coral Hollow, Cinderpeak, Frostveil, Glowgrove.
 * The stranger half of the planet: one region is entirely underwater, one is
 * a live volcano, one is polar, and one only makes sense in the dark.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = global.TW;
  var C = TW.core;
  var N = TW.nature;
  var P = TW.props;
  var PAL = P.palette;
  var B = TW.biomes;
  var group = C.group, pivot = C.pivot, mesh = C.mesh, box = C.box, rock = C.rock;
  var cone = C.cone, tube = C.tube, torus = C.torus, sphere = C.sphere;
  var link = C.link, beam = C.beam, poly = C.poly, ribbon = C.ribbon, slab = C.slab;
  var mat = C.mat, dyn = C.dyn, rand = C.rand, TAU = C.TAU;

  /* =========================================================================
   * CORAL HOLLOW — the reef, entirely below the waterline.
   * A wrecked hull, coral gardens, and a lantern that wakes the whole reef.
   * ========================================================================= */
  B.list.push(function coralhollow(ctx) {
    var id = 'coralhollow';
    var at = function (x, z, build, opts) { return ctx.place(id, x, z, build, opts); };

    /* --- coral gardens -------------------------------------------------------- */

    /* A branching coral, grown by recursion. Handed a material so the wonder
     * can switch every polyp in the region on at once. */
    function branchCoral(g, x, z, height, material, depth) {
      depth = depth === undefined ? 3 : depth;
      function grow(from, dir, len, radius, level) {
        var to = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len];
        link(g, from, to, radius, material, 5, radius * 0.72);
        if (level <= 0) {
          sphere(g, to[0], to[1], to[2], radius * 1.5, material, 0);
          return;
        }
        for (var b = 0; b < 3; b++) {
          var a = (b * TAU) / 3 + ctx.rand(-0.5, 0.5);
          var spread = 0.55;
          grow(to,
            [dir[0] + Math.cos(a) * spread, dir[1] * 0.72 + 0.25, dir[2] + Math.sin(a) * spread],
            len * 0.68, radius * 0.66, level - 1);
        }
      }
      grow([x, 0, z], [0, 1, 0], height * 0.4, height * 0.075, depth);
    }

    /* Every reef material is collected so one switch lights them all. */
    var reefMaterials = [];
    function reefMat(color) {
      var m = mat(color, { emissive: color, emissiveIntensity: 0, roughness: 0.62 });
      if (reefMaterials.indexOf(m) < 0) reefMaterials.push(m);
      return m;
    }

    var coralColors = ['#e8708c', '#f2a05c', '#8f7ad8', '#5fc4b8', '#e0d06a'];
    var coralSpots = [
      [-2.4, -1.6, 1.5], [-1.2, -2.6, 1.1], [1.8, -2.2, 1.4], [2.9, -0.6, 1.2],
      [2.2, 1.9, 1.6], [0.4, 2.8, 1.3], [-1.9, 2.4, 1.5], [-3.1, 0.8, 1.2],
      [-0.8, 0.9, 0.9], [1.1, -0.4, 1.0],
    ];
    coralSpots.forEach(function (s, i) {
      at(s[0], s[1], function (g) {
        branchCoral(g, 0, 0, s[2], reefMat(coralColors[i % 5]), i % 2 ? 3 : 2);
        /* fan corals and tube sponges around the base */
        for (var f = 0; f < 3; f++) {
          var a = (f * TAU) / 3 + i;
          var fan = mesh(g, new T.CircleGeometry(0.34, 9, 0, Math.PI),
            mat(coralColors[(i + f) % 5], { side: T.DoubleSide, roughness: 0.7 }),
            Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5);
          fan.rotation.set(0, -a, 0.2);
        }
        for (var t2 = 0; t2 < 4; t2++) {
          var ta = ctx.rand(0, TAU), tr = ctx.rand(0.3, 0.7);
          cone(g, Math.cos(ta) * tr, 0.16, Math.sin(ta) * tr, 0.06, 0.32,
            reefMat(coralColors[(i + t2) % 5]), 7, 0.05);
        }
      });
      ctx.block(id, s[0], s[1], 0.4);
    });

    /* --- kelp ------------------------------------------------------------------ */
    for (var k = 0; k < 26; k++) {
      var ka = (k / 26) * TAU;
      var kr = 3.4 + Math.sin(k * 2.7) * 1.1;
      (function (kx, kz, k) {
        at(kx, kz, function (g) {
          var sway = pivot(g, 0, 0, 0);
          var h = ctx.rand(1.6, 3.0);
          /* One swept ribbon that curls as it rises: a whole frond in a single
           * mesh, so the reef can afford dozens of them. */
          var lean = ctx.rand(-0.5, 0.5);
          var pts = [];
          var widths = [];
          for (var s = 0; s <= 8; s++) {
            var u = s / 8;
            pts.push([Math.sin(u * 2.2 + lean) * 0.42 * u, u * h, Math.cos(u * 1.7 + lean) * 0.3 * u]);
            widths.push(0.34 * (1 - u * 0.55) * (0.4 + Math.sin(u * Math.PI) * 0.9));
          }
          ribbon(sway, pts, widths, k % 3 ? '#3f8a6a' : '#59a06a');
          /* a few float bladders along the stem */
          for (var f2 = 1; f2 < 4; f2++) {
            var u2 = f2 / 4;
            sphere(sway, Math.sin(u2 * 2.2 + lean) * 0.42 * u2 + 0.09, u2 * h,
              Math.cos(u2 * 1.7 + lean) * 0.3 * u2, 0.055, '#8fc07a', 0);
          }
          C.bake(sway, true);
          dyn(sway, function (t) {
            sway.rotation.z = Math.sin(t * 0.8 + kx) * 0.22;
            sway.rotation.x = Math.cos(t * 0.6 + kz) * 0.16;
          });
        });
      })(Math.cos(ka) * kr, Math.sin(ka) * kr, k);
    }

    /* --- the wreck -------------------------------------------------------------- */
    at(-2.8, -3.0, function (g) {
      var hull = group(g, 0, 0.3, 0);
      hull.rotation.set(0.2, 0.5, 0.34);
      mesh(hull, poly(
        [[-0.62, 0.5, -1.7], [0.62, 0.5, -1.7], [0.75, 0.5, 0.4], [0, 0.5, 2.1], [-0.75, 0.5, 0.4],
         [-0.42, -0.35, -1.4], [0.42, -0.35, -1.4], [0.5, -0.35, 0.35], [0, -0.28, 1.7], [-0.5, -0.35, 0.35]],
        [[0, 5, 6], [0, 6, 1], [1, 6, 7], [1, 7, 2], [2, 7, 8], [2, 8, 3],
         [3, 8, 9], [3, 9, 4], [4, 9, 5], [4, 5, 0], [5, 7, 6], [5, 9, 7], [7, 9, 8]]
      ), '#7a5f46');
      for (var r = 0; r < 6; r++) {
        var rz = -1.5 + r * 0.6;
        var w = 0.7 - Math.abs(rz) * 0.05;
        beam(hull, [-w, 0.5, rz], [w, 0.5, rz], 0.05, '#66503b', 0.06);
      }
      /* a snapped mast lying across the sand */
      var mast = link(g, [0.3, 0.3, 0.6], [2.4, 0.15, 1.6], 0.09, '#6b543f', 6, 0.06);
      link(g, [1.1, 0.24, 1.0], [1.4, 0.7, 0.4], 0.05, '#6b543f', 5, 0.03);
      /* torn sail */
      var sail = mesh(g, poly([[1.2, 0.3, 1.0], [2.1, 0.9, 1.3], [2.3, 0.2, 1.55], [1.5, 0.15, 1.1]],
        [[0, 1, 2], [0, 2, 3]]),
        mat('#dfd6be', { side: T.DoubleSide, transparent: true, opacity: 0.85 }));
      sail.castShadow = false;
      /* treasure spilling from a split crate */
      P.crate(g, -1.3, 0.02, 1.2, 0.3, '#6b543f');
      for (var c2 = 0; c2 < 9; c2++) {
        var ca = ctx.rand(0, TAU), cr = ctx.rand(0.1, 0.5);
        var coin = tube(g, -1.3 + Math.cos(ca) * cr, 0.03, 1.2 + Math.sin(ca) * cr,
          0.045, 0.012, reefMat('#f0cd6a'), 8);
        coin.rotation.set(ctx.rand(-0.3, 0.3), ctx.rand(0, TAU), ctx.rand(-0.3, 0.3));
      }
      branchCoral(g, 0.6, -1.2, 0.9, reefMat('#e8708c'), 2);
      N.fish(g, 1.2, 1.0, 0, 0.9, '#f2a45c');
      N.fish(g, -1.4, 1.4, -0.6, 0.7, '#6fc8e0');
    }, { heading: 0.6 });
    ctx.block(id, -2.8, -3.0, 1.5);

    /* --- the reef lantern (the wonder) ------------------------------------------ */
    var lantern = at(0.7, 1.0, function (g) {
      /* a stone cairn holding a glass float */
      for (var s = 0; s < 5; s++) {
        rock(g, Math.sin(s * 1.9) * 0.12, 0.13 + s * 0.24, Math.cos(s * 1.9) * 0.12,
          0.4 - s * 0.055, 0.16, 0.38 - s * 0.05, s % 2 ? '#7e8f8c' : '#69807e');
      }
      var glassMat = mat('#9ff0e4', {
        emissive: '#5fe0cc', emissiveIntensity: 0.25,
        transparent: true, opacity: 0.72, roughness: 0.2, metalness: 0.1,
      });
      var orb = sphere(g, 0, 1.5, 0, 0.32, glassMat, 2);
      orb.castShadow = false;
      for (var b = 0; b < 6; b++) {
        var ba = (b * TAU) / 6;
        link(g, [Math.cos(ba) * 0.3, 1.24, Math.sin(ba) * 0.3],
          [Math.cos(ba) * 0.16, 1.82, Math.sin(ba) * 0.16], 0.012, '#c8b48a', 4);
      }
      torus(g, 0, 1.84, 0, 0.14, 0.018, '#c8b48a', 10, true);

      /* schooling fish, hidden until the reef wakes */
      var school = group(g, 0, 1.4, 0);
      school.visible = false;
      var schoolFish = [];
      for (var f = 0; f < 16; f++) {
        var fa = (f / 16) * TAU;
        var fr = 1.5 + (f % 4) * 0.32;
        var fish = N.fish(school, Math.cos(fa) * fr, ((f % 5) - 2) * 0.3, Math.sin(fa) * fr,
          0.5, ['#f2c45c', '#6fc8e0', '#f28a9c'][f % 3]);
        schoolFish.push(fish);
      }
      var bubbles = N.motes(g, {
        x: 0, y: 0.4, z: 0, count: 26, radius: 2.2, height: 3.0,
        size: 0.035, color: '#dffaf4', speed: 0.5, glow: 0.5, opacity: 0.5,
      });

      var awake = false;
      ctx.tick(function (t) {
        var target = awake ? 1.4 : 0;
        for (var i = 0; i < reefMaterials.length; i++) {
          reefMaterials[i].emissiveIntensity = C.damp(reefMaterials[i].emissiveIntensity, target, 2.4, 1 / 60);
        }
        glassMat.emissiveIntensity = C.damp(glassMat.emissiveIntensity, awake ? 2.6 : 0.25, 2.4, 1 / 60);
        orb.scale.setScalar(1 + Math.sin(t * 1.6) * (awake ? 0.06 : 0.02));
        school.rotation.y = t * 0.24;
        school.position.y = 1.4 + Math.sin(t * 0.7) * 0.35;
      });

      g.userData.activate = function () {
        awake = !awake;
        school.visible = awake;
        return awake
          ? 'The reef lights up like a city. Everything that lives here comes to look.'
          : 'The reef dims, and the fish drift back into the blue.';
      };
    });
    ctx.block(id, 0.7, 1.0, 0.7);

    ctx.wonder({
      id: 'coralhollow-lantern',
      biome: id,
      label: 'The reef lantern',
      action: 'Wake the reef',
      description: 'One glass float, and the whole hollow turns its lights on.',
      x: 0.7, z: 1.0, radius: 2.6,
      activate: lantern.userData.activate,
    });

    /* --- seabed detail ---------------------------------------------------------- */
    for (var i = 0; i < 34; i++) {
      var a = i * 2.399;
      var r = 1.2 + (i / 34) * 3.6;
      (function (x, z, i) {
        at(x, z, function (g) {
          if (i % 4 === 0) {
            /* sea urchin */
            sphere(g, 0, 0.12, 0, 0.11, '#4a3f5c', 1);
            for (var s = 0; s < 12; s++) {
              var sa = s * 2.399;
              var sy = Math.cos(s * 0.7);
              link(g, [0, 0.12, 0],
                [Math.cos(sa) * 0.2, 0.12 + sy * 0.2, Math.sin(sa) * 0.2], 0.012, '#6b5a80', 3, 0.004);
            }
          } else if (i % 3 === 0) {
            /* starfish on the sand */
            for (var arm = 0; arm < 5; arm++) {
              var aa = (arm * TAU) / 5;
              box(g, Math.cos(aa) * 0.12, 0.02, Math.sin(aa) * 0.12, 0.08, 0.04, 0.19, '#e8708c', -aa);
            }
          } else if (i % 5 === 0) {
            N.fish(g, 0, 0.9, 0, 0.6, ['#f2c45c', '#6fc8e0'][i % 2]);
          } else {
            rock(g, 0, 0.04, 0, ctx.rand(0.1, 0.22), 0.07, ctx.rand(0.1, 0.2), '#8ba39c');
          }
        });
      })(Math.cos(a) * r, Math.sin(a) * r, i);
    }

    ctx.wisp(id, -4.0, 2.6, 1.4);
    ctx.wisp(id, 3.6, -3.2, 1.4);
  });

  /* =========================================================================
   * CINDERPEAK — the volcano.
   * A research station on the flank, obsidian fields, and a telescope that
   * asks the mountain how it is feeling.
   * ========================================================================= */
  B.list.push(function cinderpeak(ctx) {
    var id = 'cinderpeak';
    var at = function (x, z, build, opts) { return ctx.place(id, x, z, build, opts); };

    ctx.path(id, [[-4.2, 3.2], [-3.0, 2.2], [-2.0, 1.4], [-1.2, 0.6]], 0.7, '#7a6a5e');

    /* Every glowing crack and vent shares this material set. */
    var lavaMats = [];
    function lavaMat(color) {
      var m = mat(color, { emissive: color, emissiveIntensity: 0.5, roughness: 0.55 });
      if (lavaMats.indexOf(m) < 0) lavaMats.push(m);
      return m;
    }

    /* --- the crater ------------------------------------------------------------- */
    at(0, 0, function (g) {
      /* a ring of jagged rim rocks */
      for (var i = 0; i < 16; i++) {
        var a = (i / 16) * TAU;
        var r = 1.35 + ctx.rand(-0.12, 0.12);
        rock(g, Math.cos(a) * r, ctx.rand(0.06, 0.24), Math.sin(a) * r,
          ctx.rand(0.2, 0.42), ctx.rand(0.24, 0.55), ctx.rand(0.2, 0.4),
          i % 3 ? '#4a423e' : '#605349');
      }
      /* the glowing pool */
      var pool = mesh(g, new T.CircleGeometry(1.2, 20), lavaMat('#f2622e'), 0, -0.06, 0);
      pool.geometry.rotateX(-Math.PI / 2);
      pool.castShadow = false;
      for (var c2 = 0; c2 < 7; c2++) {
        var ca = ctx.rand(0, TAU), cr = ctx.rand(0.2, 0.9);
        var crust = rock(g, Math.cos(ca) * cr, -0.02, Math.sin(ca) * cr,
          ctx.rand(0.16, 0.34), 0.05, ctx.rand(0.16, 0.3), '#332c2a');
      }
      N.smoke(g, 0, 0.3, 0, { count: 8, rise: 3.6, spread: 0.5, size: 0.4, speed: 0.13, color: '#8f8880', opacity: 0.9 });
      var embers = N.motes(g, {
        x: 0, y: 0.6, z: 0, count: 22, radius: 1.3, height: 2.6,
        size: 0.035, color: '#ff9a4a', speed: 0.55, glow: 2.2,
      });
      g.userData.embers = embers;
    });
    ctx.block(id, 0, 0, 1.5);

    /* --- lava flows down the flanks ----------------------------------------------- */
    /* These run for five or six metres down a slope, so they are laid with
     * ctx.path — which drapes over the terrain — rather than as one flat
     * ribbon anchored at a single point, which would hover at the far end. */
    [[-0.8, 1.0], [0.9, 1.2], [1.2, -0.9], [-1.1, -1.0]].forEach(function (dir, i) {
      var len = Math.hypot(dir[0], dir[1]);
      var ux = dir[0] / len, uz = dir[1] / len;
      var sx = -uz, sz = ux;                 /* the sideways axis of the flow */
      var line = [];
      for (var s = 0; s <= 8; s++) {
        var reach = 1.5 + s * 0.62;
        var wobble = Math.sin(s * 0.8 + i) * 0.42;
        line.push([ux * reach + sx * wobble, uz * reach + sz * wobble]);
      }
      ctx.path(id, line, 0.52, lavaMat(i % 2 ? '#e0521f' : '#f2723a'), 0.045);
      /* cooled crust islands, each dropped on its own bit of ground */
      for (var r = 0; r < 7; r++) {
        var reach2 = 1.7 + r * 0.7;
        var wob2 = Math.sin(r * 1.7 + i) * 0.55;
        at(ux * reach2 + sx * wob2, uz * reach2 + sz * wob2, function (g) {
          rock(g, 0, 0.06, 0, ctx.rand(0.12, 0.26), ctx.rand(0.1, 0.22), ctx.rand(0.12, 0.24), '#3a3330');
        });
      }
    });

    /* --- steam vents --------------------------------------------------------------- */
    [[-2.6, -1.8], [2.4, 2.0], [3.1, -1.4]].forEach(function (v, i) {
      at(v[0], v[1], function (g) {
        for (var s = 0; s < 8; s++) {
          var a = (s / 8) * TAU;
          rock(g, Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3, 0.13, 0.12, 0.13, '#5c5148');
        }
        cone(g, 0, 0.1, 0, 0.28, 0.2, lavaMat('#e8763c'), 8, 0.16);
        N.smoke(g, 0, 0.2, 0, { count: 5, rise: 2.0, spread: 0.3, size: 0.2, speed: 0.22, color: '#d8d0c4' });
      });
      ctx.block(id, v[0], v[1], 0.4);
    });

    /* --- basalt columns ------------------------------------------------------------ */
    at(-3.2, -0.4, function (g) {
      for (var i = 0; i < 14; i++) {
        var a = i * 2.399;
        var r = ctx.rand(0, 0.9);
        var h = ctx.rand(0.7, 2.1);
        var col = cone(g, Math.cos(a) * r, h / 2, Math.sin(a) * r, 0.19, h,
          i % 2 ? '#3f3b3c' : '#4b4645', 6, 0.18);
        col.rotation.set(ctx.rand(-0.05, 0.05), ctx.rand(0, TAU), ctx.rand(-0.05, 0.05));
      }
    });
    ctx.block(id, -3.2, -0.4, 1.0);

    /* --- the expedition station (the wonder) ----------------------------------------- */
    var station = at(-2.3, 2.4, function (g) {
      /* a raised platform hut */
      box(g, 0, 0.16, 0, 1.5, 0.1, 1.2, '#565e62');
      for (var sx = -1; sx <= 1; sx += 2) {
        for (var sz = -1; sz <= 1; sz += 2) tube(g, sx * 0.66, 0.08, sz * 0.5, 0.05, 0.2, '#3f474b', 6);
      }
      box(g, -0.15, 0.56, 0, 1.05, 0.7, 1.0, '#e2e6e0');
      box(g, -0.15, 0.56, 0, 1.07, 0.14, 1.02, '#d2624a');
      P.gableRoof(g, 1.2, 1.12, 0.9, 1.16, '#4e6470');
      P.door(g, -0.15, 0.21, 0.51, 0.24, 0.42, '#3f474b');
      P.window(g, -0.15, 0.66, -0.51, 0.24, 0.2, '#e2e6e0', PAL.glass);
      P.window(g, 0.38, 0.62, 0.02, 0.2, 0.18, '#e2e6e0', PAL.glass);

      /* solar panel and instrument mast */
      var panel = box(g, 0.62, 0.72, -0.42, 0.5, 0.03, 0.38, '#2b3a52');
      panel.rotation.set(-0.45, 0.3, 0);
      tube(g, 0.62, 0.44, -0.42, 0.02, 0.56, '#8f979b', 5);
      var mast = P.mast(g, 0.85, 0.55, 1.5, { heading: -0.5 });

      /* crates and a flag */
      P.crate(g, -1.0, 0, 0.75, 0.26, '#8a7f70');
      P.crate(g, -0.75, 0, 0.95, 0.22, '#9a8f80');
      P.barrel(g, 1.0, 0, 0.7, 0.8, '#7b7469');
      tube(g, -1.4, 0.6, -0.3, 0.02, 1.2, '#b8c0c4', 5);
      var flag = mesh(g, poly([[-1.39, 1.16, -0.3], [-0.9, 1.06, -0.32], [-1.39, 0.86, -0.3]]),
        mat('#e0a24a', { side: T.DoubleSide }));

      /* the telescope */
      var scope = P.telescope(g, 0.05, -0.9, 0.5);

      var reading = false;
      var pulse = 0;
      ctx.tick(function (t) {
        pulse = C.damp(pulse, reading ? 1 : 0, 1.6, 1 / 60);
        for (var i = 0; i < lavaMats.length; i++) {
          lavaMats[i].emissiveIntensity =
            0.45 + pulse * (1.6 + Math.sin(t * 1.5 + i) * 0.5) + Math.sin(t * 0.8 + i) * 0.1;
        }
        scope.userData.yaw.rotation.y = Math.sin(t * 0.35) * 0.6 + (reading ? 0.9 : 0);
        scope.userData.pitch.rotation.x = -0.12 + Math.sin(t * 0.5) * 0.08 - pulse * 0.25;
        mast.userData.dish.rotation.y = t * (reading ? 0.9 : 0.14);
        flag.rotation.y = Math.sin(t * 1.8) * 0.14;
      });

      g.userData.activate = function () {
        reading = !reading;
        return reading
          ? 'The instruments come alive. Cinderpeak grumbles, pleased to be noticed.'
          : 'The readings settle. The mountain goes back to dozing.';
      };
    }, { heading: 0.4 });
    ctx.block(id, -2.3, 2.4, 1.2);

    ctx.wonder({
      id: 'cinderpeak-station',
      biome: id,
      label: 'The expedition station',
      action: 'Read the instruments',
      description: 'Check on the mountain. It likes being asked.',
      x: -2.3, z: 2.4, radius: 2.4,
      activate: station.userData.activate,
    });

    /* --- obsidian and ash fields -------------------------------------------------- */
    for (var i2 = 0; i2 < 30; i2++) {
      var a2 = i2 * 2.399;
      var r2 = 2.4 + (i2 / 30) * 2.6;
      (function (x, z, i) {
        at(x, z, function (g) {
          if (i % 6 === 0) {
            /* obsidian shards */
            for (var s = 0; s < 4; s++) {
              var sa = ctx.rand(0, TAU);
              var shard = cone(g, Math.cos(sa) * 0.14, ctx.rand(0.14, 0.3), Math.sin(sa) * 0.14,
                ctx.rand(0.06, 0.11), ctx.rand(0.3, 0.62),
                mat('#241f26', { roughness: 0.22, metalness: 0.28 }), 5, 0.02);
              shard.rotation.set(ctx.rand(-0.2, 0.2), ctx.rand(0, TAU), ctx.rand(-0.2, 0.2));
            }
          } else if (i % 4 === 0) {
            N.snag(g, 0, 0, ctx.rand(0.8, 1.4), '#4e423a');
          } else {
            rock(g, 0, 0.06, 0, ctx.rand(0.14, 0.32), ctx.rand(0.1, 0.28), ctx.rand(0.14, 0.3),
              i % 2 ? '#6b5c52' : '#43413e');
          }
        });
      })(Math.cos(a2) * r2, Math.sin(a2) * r2, i2);
    }

    ctx.wisp(id, 3.9, 3.0);
    ctx.wisp(id, -4.2, -2.4);
  });

  /* =========================================================================
   * FROSTVEIL — the tundra.
   * An ice camp, a frozen lake, and a chime that calls the aurora down.
   * ========================================================================= */
  B.list.push(function frostveil(ctx) {
    var id = 'frostveil';
    var at = function (x, z, build, opts) { return ctx.place(id, x, z, build, opts); };

    ctx.path(id, [[-3.8, 2.4], [-2.2, 1.6], [-0.8, 1.0], [0.8, 0.8], [2.4, 1.4], [3.8, 2.6]], 0.7, '#cfe2e6');

    /* --- the ice camp ----------------------------------------------------------- */
    at(-1.6, -1.2, function (g) {
      /* an igloo, built as a dome of blocks */
      for (var ring = 0; ring < 4; ring++) {
        var ry = ring * 0.19;
        var rr = 0.78 * Math.cos((ring / 4.6) * Math.PI * 0.5);
        var count = Math.max(5, Math.round(10 - ring * 1.4));
        for (var b = 0; b < count; b++) {
          var a = (b / count) * TAU + ring * 0.3;
          var blk = box(g, Math.cos(a) * rr, ry + 0.09, Math.sin(a) * rr,
            0.28, 0.19, 0.2, b % 2 ? '#eef7f7' : '#e0eef1', -a);
        }
      }
      sphere(g, 0, 0.82, 0, 0.26, '#eef7f7', 1);
      /* the entrance tunnel */
      var tunnel = mesh(g, new T.CylinderGeometry(0.26, 0.3, 0.5, 9, 1, true),
        mat('#e6f2f4', { side: T.DoubleSide }), 0, 0.26, 0.86);
      tunnel.rotation.x = Math.PI / 2;
      mesh(g, new T.CircleGeometry(0.24, 9), '#2f4a56', 0, 0.26, 1.1).rotation.y = 0;

      /* a sled and dog */
      var sled = group(g, 1.5, 0, 0.4, 1, 0.5);
      box(sled, 0, 0.16, 0, 0.4, 0.03, 0.86, '#b58a55');
      for (var s = -1; s <= 1; s += 2) {
        beam(sled, [s * 0.22, 0.06, -0.44], [s * 0.22, 0.06, 0.48], 0.03, '#8a6a48', 0.05);
        link(sled, [s * 0.22, 0.06, 0.44], [s * 0.22, 0.2, 0.52], 0.025, '#8a6a48', 4);
        tube(sled, s * 0.22, 0.12, -0.2, 0.02, 0.14, '#8a6a48', 4);
      }
      box(sled, 0, 0.28, -0.34, 0.36, 0.22, 0.2, '#c9784f');
      P.sack(sled, 0, 0.18, 0.1, 0.8, '#e0d6bc');
      N.critter(g, 2.2, 0.9, { body: '#e6e0d2', accent: '#4a4038', tailColor: '#e6e0d2', scale: 0.9 });

      /* fishing hole and rod */
      var hole = mesh(g, new T.CircleGeometry(0.28, 12),
        mat('#2c6a80', { roughness: 0.2, metalness: 0.2 }), -1.5, 0.03, 0.9);
      hole.geometry.rotateX(-Math.PI / 2);
      hole.castShadow = false;
      link(g, [-1.9, 0.06, 0.6], [-1.6, 0.4, 0.82], 0.014, '#8a6a48', 4);
      link(g, [-1.6, 0.4, 0.82], [-1.5, 0.04, 0.9], 0.004, '#d8d2c0', 3);
      P.crate(g, -2.1, 0, 0.35, 0.22, '#a8845a');

      /* a lit brazier */
      var brazier = group(g, 0.2, 0, -1.3);
      cone(brazier, 0, 0.2, 0, 0.2, 0.4, '#5a6266', 8, 0.26);
      for (var l = 0; l < 3; l++) {
        var la = (l * TAU) / 3;
        link(brazier, [Math.cos(la) * 0.16, 0, Math.sin(la) * 0.16], [0, 0.16, 0], 0.02, '#454c50', 4);
      }
      N.flames(brazier, 0, 0.4, 0, 0.8, '#f7b14c');
    }, { heading: -0.3 });
    ctx.block(id, -1.6, -1.2, 1.25);

    /* --- frozen lake -------------------------------------------------------------- */
    at(2.2, -1.8, function (g) {
      var ice = mesh(g, new T.CircleGeometry(1.7, 24),
        mat('#b6e0ea', { transparent: true, opacity: 0.82, roughness: 0.14, metalness: 0.2 }), 0, 0.04, 0);
      ice.geometry.rotateX(-Math.PI / 2);
      ice.castShadow = false;
      /* cracks */
      for (var c2 = 0; c2 < 6; c2++) {
        var ca = (c2 / 6) * TAU + 0.4;
        ribbon(g, [[0, 0.05, 0], [Math.cos(ca) * 0.9, 0.05, Math.sin(ca) * 0.9],
          [Math.cos(ca + 0.3) * 1.6, 0.05, Math.sin(ca + 0.3) * 1.6]], 0.05, '#8fc8d8');
      }
      /* ice shards standing at the edges */
      for (var s2 = 0; s2 < 10; s2++) {
        var sa = (s2 / 10) * TAU;
        var sr = 1.85 + ctx.rand(-0.15, 0.15);
        var shard = cone(g, Math.cos(sa) * sr, ctx.rand(0.2, 0.45), Math.sin(sa) * sr,
          ctx.rand(0.09, 0.19), ctx.rand(0.5, 1.0),
          mat('#c8e8f0', { roughness: 0.2, metalness: 0.1 }), 5, 0.03);
        shard.rotation.set(ctx.rand(-0.16, 0.16), ctx.rand(0, TAU), ctx.rand(-0.16, 0.16));
      }
      N.critter(g, 2.3, 0.4, {
        body: '#2f3a44', accent: '#e8a24a',
        tailColor: '#f4f0e4', scale: 0.85, ears: false,
      });
    });
    ctx.block(id, 2.2, -1.8, 1.7);

    /* --- the aurora chime (the wonder) --------------------------------------------- */
    var regionAxis = ctx.biomes[id].center.clone();
    var chime = at(0.9, 2.3, function (g) {
      /* a frame of ice with hanging chimes */
      for (var s = -1; s <= 1; s += 2) {
        var post = cone(g, s * 0.62, 0.62, 0, 0.11, 1.25,
          mat('#cbe9f2', { roughness: 0.2, metalness: 0.12 }), 6, 0.07);
        post.rotation.z = s * -0.07;
      }
      beam(g, [-0.58, 1.22, 0], [0.58, 1.22, 0], 0.06, '#b6dfec', 0.07);
      var chimeMat = mat('#a8e8f0', {
        emissive: '#6fd8e8', emissiveIntensity: 0.3,
        transparent: true, opacity: 0.88, roughness: 0.2, metalness: 0.15,
      });
      var bars = [];
      for (var b = 0; b < 5; b++) {
        var bx = -0.44 + b * 0.22;
        link(g, [bx, 1.2, 0], [bx, 1.02, 0], 0.004, '#d8d2c0', 3);
        var swing = pivot(g, bx, 1.02, 0);
        var bar = cone(swing, 0, -0.24, 0, 0.036, 0.48 - b * 0.05, chimeMat, 6, 0.03);
        bar.castShadow = false;
        bars.push(swing);
      }
      /* the crystal that calls the sky */
      var coreMat = mat('#cdf2ff', {
        emissive: '#7fd8f0', emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.2,
      });
      var core = mesh(g, new T.OctahedronGeometry(0.26), coreMat, 0, 0.5, -0.55);
      core.scale.set(0.7, 1.5, 0.7);
      N.crystals(g, 1.2, -0.5, 1.1, '#9fe0f2', false);
      N.crystals(g, -1.3, 0.6, 0.9, '#b6e8f2', false);

      /* THE AURORA — three curtains hung over the region.
       * Built in world space and bent around the globe, so from the ground they
       * arc overhead and from the globe view they ribbon across the pole. Basic
       * material with additive blending: an aurora emits, it is not lit, and
       * the additive pass feeds the bloom chain beautifully. */
      var bands = [];
      var bandColors = ['#6ff0b0', '#7fd0f0', '#c08ff0'];
      var sky = ctx.sky(function (holder) {
        for (var band = 0; band < 3; band++) {
          var verts = [];
          var colors = [];
          var faces = [];
          var steps = 34;
          var tone = new T.Color(bandColors[band]);
          var dim = tone.clone().multiplyScalar(0.12);
          for (var p2 = 0; p2 <= steps; p2++) {
            var u = p2 / steps;
            var lx = (u - 0.5) * 11.5;
            var lz = Math.sin(u * 3.4 + band * 1.7) * 2.6 - band * 1.3 + 1.8;
            var dir = ctx.normalAt(id, lx, lz);
            /* Well clear of the tallest hill: a curtain you look up at, not
             * one you walk through. */
            var base = ctx.RADIUS + 3.4 + band * 0.6;
            var h = 0.9 + Math.sin(u * Math.PI) * 2.4 + Math.sin(u * 5 + band) * 0.4;
            verts.push(dir.clone().multiplyScalar(base).toArray());
            verts.push(dir.clone().multiplyScalar(base + h).toArray());
            colors.push([tone.r, tone.g, tone.b], [dim.r, dim.g, dim.b]);
            if (p2) faces.push([p2 * 2 - 2, p2 * 2 - 1, p2 * 2], [p2 * 2 - 1, p2 * 2 + 1, p2 * 2]);
          }
          var bandMat = new T.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0,
            depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
          });
          var curtain = new T.Mesh(C.poly(verts, faces, colors), bandMat);
          curtain.castShadow = false;
          curtain.renderOrder = 7;
          holder.add(curtain);
          bands.push({ mesh: curtain, material: bandMat, phase: band * 2.1 });
        }
      });
      sky.visible = false;

            var calling = false;
      var glow = 0;
      ctx.tick(function (t) {
        glow = C.damp(glow, calling ? 1 : 0, 1.4, 1 / 60);
        chimeMat.emissiveIntensity = 0.28 + glow * 2.0;
        coreMat.emissiveIntensity = 0.4 + glow * 2.6;
        core.rotation.y = t * (calling ? 0.9 : 0.2);
        core.position.y = 0.5 + Math.sin(t * 1.4) * 0.05;
        for (var i = 0; i < bars.length; i++) {
          bars[i].rotation.z = Math.sin(t * (1.6 + i * 0.2) + i) * (0.05 + glow * 0.18);
        }
        sky.visible = glow > 0.02;
        for (var b2 = 0; b2 < bands.length; b2++) {
          var band2 = bands[b2];
          band2.material.opacity = glow * (0.26 + Math.sin(t * 0.5 + band2.phase) * 0.08);
          /* A slow roll about the region's own axis, so the curtains drift
           * across the sky without ever leaving the planet. */
          band2.mesh.setRotationFromAxisAngle(regionAxis, Math.sin(t * 0.09 + band2.phase) * 0.09);
        }
      });

      g.userData.activate = function () {
        calling = !calling;
        return calling
          ? 'The chimes ring once, and the sky answers in green and violet.'
          : 'The aurora folds itself away. The tundra is quiet again.';
      };
    }, { heading: 0.2 });
    ctx.block(id, 0.9, 2.3, 0.9);

    ctx.wonder({
      id: 'frostveil-chime',
      biome: id,
      label: 'The aurora chime',
      action: 'Ring the chime',
      description: 'Ask the polar sky to come out and dance.',
      x: 0.9, z: 2.3, radius: 2.4,
      activate: chime.userData.activate,
    });

    /* --- snow forest and ice --------------------------------------------------------- */
    var snowTrees = [[-3.4, -0.2], [-3.9, 1.3], [-2.8, 2.9], [-1.4, 3.6], [0.4, 3.9], [2.2, 3.6],
      [3.6, 2.0], [4.0, 0.2], [3.2, -3.0], [1.4, -3.8], [-0.6, -3.6], [-2.6, -3.2]];
    snowTrees.forEach(function (p, i) {
      at(p[0], p[1], function (g) {
        var h = ctx.rand(1.3, 2.2);
        N.pine(g, 0, 0, h, i % 2 ? '#4c8272' : '#3f7566', 0);
        /* snow caps */
        cone(g, 0, h * 0.95, 0, h * 0.15, h * 0.2, '#f4fbfb', 5);
        cone(g, 0, h * 0.72, 0, h * 0.23, h * 0.14, '#e8f4f6', 5);
      });
      ctx.block(id, p[0], p[1], 0.2);
    });

    for (var i3 = 0; i3 < 24; i3++) {
      var a3 = i3 * 2.399;
      var r3 = 1.6 + (i3 / 24) * 3.2;
      (function (x, z, i) {
        at(x, z, function (g) {
          if (i % 5 === 0) N.crystals(g, 0, 0, ctx.rand(0.6, 1.1), '#bfe6f2', false);
          else if (i % 3 === 0) rock(g, 0, 0.06, 0, ctx.rand(0.14, 0.3), ctx.rand(0.1, 0.24), ctx.rand(0.14, 0.28), '#e2eef0');
          else rock(g, 0, 0.02, 0, ctx.rand(0.2, 0.4), 0.05, ctx.rand(0.2, 0.36), '#f2fafa');
        });
      })(Math.cos(a3) * r3, Math.sin(a3) * r3, i3);
    }

    /* drifting snow over the whole region */
    at(0, 0, function (g) {
      N.motes(g, {
        x: 0, y: 1.5, z: 0, count: 60, radius: 5.5, height: 3.5,
        size: 0.03, color: '#ffffff', speed: 0.16, glow: 0.35, opacity: 0.6,
      });
    }, { lift: 0 });

    ctx.wisp(id, -4.3, 3.4);
    ctx.wisp(id, 3.9, -3.6);
  });

  /* =========================================================================
   * GLOWGROVE — the night hollow.
   * A bowl of giant fungus and crystal, where nothing is lit until you ask.
   * ========================================================================= */
  B.list.push(function glowgrove(ctx) {
    var id = 'glowgrove';
    var at = function (x, z, build, opts) { return ctx.place(id, x, z, build, opts); };

    ctx.path(id, [[-3.6, 2.8], [-2.2, 1.8], [-1.0, 1.0], [0.4, 0.6], [1.8, 1.2], [3.2, 2.6]], 0.68, '#4e6b70');

    /* Every glowing surface in the grove shares this set. */
    var glowMats = [];
    function glowMat(color, base) {
      var m = mat(color, {
        emissive: color, emissiveIntensity: base === undefined ? 0.12 : base, roughness: 0.55,
      });
      if (glowMats.indexOf(m) < 0) glowMats.push(m);
      return m;
    }

    /** A giant mushroom with a glowing underside and a ring of gills. */
    function giantShroom(g, x, z, height, capColor, stemColor) {
      var stem = cone(g, x, height * 0.42, z, height * 0.14, height * 0.84, stemColor || '#cfd6c4', 9, height * 0.09);
      stem.rotation.z = ctx.rand(-0.06, 0.06);
      var cap = mesh(g, new T.SphereGeometry(height * 0.52, 12, 6, 0, TAU, 0, Math.PI / 2),
        glowMat(capColor, 0.1), x, height * 0.8, z);
      cap.scale.set(1, 0.62, 1);
      /* gills */
      for (var i = 0; i < 14; i++) {
        var a = (i / 14) * TAU;
        var gill = box(g, x + Math.cos(a) * height * 0.3, height * 0.79, z + Math.sin(a) * height * 0.3,
          0.03, 0.03, height * 0.36, glowMat('#f0fff4', 0.2));
        gill.rotation.y = -a;
      }
      torus(g, x, height * 0.79, z, height * 0.5, 0.02, glowMat('#d8fff0', 0.25), 14, true);
      for (var s = 0; s < 4; s++) {
        var sa = ctx.rand(0, TAU);
        sphere(g, x + Math.cos(sa) * height * 0.22, height * (0.86 + ctx.rand(0, 0.1)),
          z + Math.sin(sa) * height * 0.22, height * 0.045, glowMat('#ffffff', 0.3), 1);
      }
      return cap;
    }

    /* --- the grove ------------------------------------------------------------------- */
    var shroomSpots = [
      [-2.6, -2.1, 2.1, '#7ae0c0'], [2.3, -2.6, 1.7, '#8ba6f0'], [3.4, 1.2, 2.3, '#c88ff0'],
      [-3.5, 1.5, 1.9, '#7fd0f0'], [0.3, 3.6, 1.6, '#f08fb8'], [-1.2, -4.0, 1.5, '#7ae0c0'],
      [4.2, -2.9, 1.3, '#a8f08f'], [-4.3, -0.6, 1.4, '#8ba6f0'],
    ];
    shroomSpots.forEach(function (s) {
      at(s[0], s[1], function (g) {
        giantShroom(g, 0, 0, s[2], s[3]);
        /* little ones clustered round the base */
        for (var i = 0; i < 5; i++) {
          var a = (i / 5) * TAU + ctx.rand(-0.4, 0.4);
          var r = s[2] * ctx.rand(0.3, 0.6);
          var small = N.mushroom(g, Math.cos(a) * r, Math.sin(a) * r, ctx.rand(0.7, 1.5), s[3], false);
          small.traverse(function (o) {
            if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === new T.Color(s[3]).getHexString()) {
              o.material = glowMat(s[3], 0.12);
            }
          });
        }
        N.grass(g, s[2] * 0.5, s[2] * 0.3, '#3f6f66', 1.2);
      });
      ctx.block(id, s[0], s[1], s[2] * 0.22);
    });

    /* --- the standing stones ---------------------------------------------------------- */
    at(0, 0, function (g) {
      for (var i = 0; i < 7; i++) {
        var a = (i / 7) * TAU;
        var r = 1.55;
        var h = ctx.rand(1.2, 1.9);
        var stone = box(g, Math.cos(a) * r, h / 2, Math.sin(a) * r, 0.34, h, 0.24, '#55686f', -a);
        stone.rotation.z = ctx.rand(-0.05, 0.05);
        /* carved glyph */
        box(g, Math.cos(a) * (r - 0.13), h * 0.62, Math.sin(a) * (r - 0.13), 0.1, 0.1, 0.05,
          glowMat('#9fe0c8', 0.15), -a);
      }
      /* the centre plate */
      var plate = cone(g, 0, 0.06, 0, 1.0, 0.12, '#4a5c62', 14, 0.95);
      torus(g, 0, 0.14, 0, 0.72, 0.03, glowMat('#9fe0c8', 0.18), 20, true);
      torus(g, 0, 0.14, 0, 0.44, 0.024, glowMat('#9fe0c8', 0.18), 16, true);
    });
    ctx.block(id, 0, 0, 1.9);

    /* --- the lantern tree (the wonder) --------------------------------------------------- */
    var lanternTree = at(-0.4, 1.9, function (g) {
      /* a pale hollow tree hung with glass jars */
      tube(g, 0, 1.0, 0, 0.26, 2.0, '#8ba0a6', 9);
      for (var br = 0; br < 5; br++) {
        var a = (br * TAU) / 5 + 0.4;
        link(g, [0, 1.5 + br * 0.1, 0],
          [Math.cos(a) * 1.15, 2.15 + Math.sin(br * 1.4) * 0.35, Math.sin(a) * 1.15], 0.06, '#8ba0a6', 5, 0.025);
      }
      rock(g, 0, 2.5, 0, 1.2, 0.6, 1.15, '#3f5c60');
      rock(g, 0.7, 2.3, 0.35, 0.6, 0.4, 0.58, '#456a6c');
      rock(g, -0.6, 2.32, -0.4, 0.55, 0.36, 0.54, '#375257');

      var jarMat = mat('#d8fff0', {
        emissive: '#8ff0d4', emissiveIntensity: 0.12,
        transparent: true, opacity: 0.85, roughness: 0.25,
      });
      var jars = [];
      for (var j = 0; j < 9; j++) {
        var ja = (j / 9) * TAU;
        var jr = 0.85 + (j % 3) * 0.18;
        var jy = 1.85 + Math.sin(j * 1.7) * 0.3;
        link(g, [Math.cos(ja) * jr * 0.85, jy + 0.45, Math.sin(ja) * jr * 0.85],
          [Math.cos(ja) * jr, jy + 0.14, Math.sin(ja) * jr], 0.005, '#7c8f92', 3);
        var jar = mesh(g, new T.CylinderGeometry(0.09, 0.11, 0.19, 8), jarMat,
          Math.cos(ja) * jr, jy, Math.sin(ja) * jr);
        jar.castShadow = false;
        tube(g, Math.cos(ja) * jr, jy + 0.11, Math.sin(ja) * jr, 0.075, 0.03, '#7c8f92', 8);
        jars.push(jar);
      }

      /* the fireflies that live in the jars */
      var swarm = N.motes(g, {
        x: 0, y: 1.4, z: 0, count: 70, radius: 4.2, height: 3.0,
        size: 0.032, color: '#a8ffd8', speed: 0.34, glow: 2.4,
      });
      swarm.visible = false;

      /* a small pool at the foot that mirrors the light */
      N.pond(g, 1.7, -1.2, 0.9, '#2f7d80', '#4e6b70');

      var awake = false;
      var level = 0;
      ctx.tick(function (t) {
        level = C.damp(level, awake ? 1 : 0, 1.5, 1 / 60);
        jarMat.emissiveIntensity = 0.1 + level * 2.4;
        for (var i = 0; i < glowMats.length; i++) {
          glowMats[i].emissiveIntensity = 0.1 + level * (1.5 + Math.sin(t * 0.9 + i * 0.4) * 0.35);
        }
        for (var j2 = 0; j2 < jars.length; j2++) {
          jars[j2].position.y += Math.sin(t * 1.3 + j2) * 0.0006;
          jars[j2].rotation.y = Math.sin(t * 0.6 + j2) * 0.3;
        }
      });

      g.userData.activate = function () {
        awake = !awake;
        swarm.visible = awake;
        return awake
          ? 'Every jar opens at once. The hollow fills with slow green light.'
          : 'The lights wind down, one jar at a time. Goodnight, Glowgrove.';
      };
    });
    ctx.block(id, -0.4, 1.9, 1.0);

    ctx.wonder({
      id: 'glowgrove-lanterns',
      biome: id,
      label: 'The lantern tree',
      action: 'Open the jars',
      description: 'Let the grove show you what it looks like awake.',
      x: -0.4, z: 1.9, radius: 2.5,
      activate: lanternTree.userData.activate,
    });

    /* --- crystal outcrops and vines ------------------------------------------------------- */
    for (var i2 = 0; i2 < 28; i2++) {
      var a2 = i2 * 2.399;
      var r2 = 2.2 + (i2 / 28) * 3.0;
      (function (x, z, i) {
        at(x, z, function (g) {
          if (i % 4 === 0) {
            N.crystals(g, 0, 0, ctx.rand(0.8, 1.5), '#8fe4d0', false);
          } else if (i % 5 === 0) {
            N.mushroom(g, 0, 0, ctx.rand(0.9, 1.7), ['#7ae0c0', '#8ba6f0', '#c88ff0'][i % 3], false);
          } else if (i % 3 === 0) {
            rock(g, 0, 0.1, 0, ctx.rand(0.2, 0.42), ctx.rand(0.15, 0.35), ctx.rand(0.2, 0.4), '#455e64');
          } else {
            N.grass(g, 0, 0, '#3f6f66', ctx.rand(0.7, 1.3));
          }
        });
      })(Math.cos(a2) * r2, Math.sin(a2) * r2, i2);
    }

    /* a rope bridge across the bowl */
    at(2.0, -3.0, function (g) {
      P.ropeBridge(g, [-1.4, 0], [1.4, 0], { width: 0.7, sag: 0.4, height: 0.5 });
    }, { heading: 0.9 });

    /* moths */
    at(1.2, 2.4, function (g) {
      N.butterfly(g, 0, 0.9, 0, '#cfe0f0', 1.2);
      N.butterfly(g, 0.6, 1.2, 0.4, '#e0d0f0', 0.9);
    });

    ctx.wisp(id, -4.2, -2.8);
    ctx.wisp(id, 3.8, 3.4);
  });
})(typeof window !== 'undefined' ? window : this);
