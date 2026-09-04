/* =============================================================================
 * A World in Your Palm — 60-explorer.js
 * The explorer and the small creature that decides to come along.
 *
 * The character is a real skeleton — nested pivots for hips, knees, ankles,
 * shoulders, elbows, hands and neck — assembled from the same boxes and
 * icosahedra as everything else. There is no skinning and no animation data:
 * the walk cycle is a handful of sines driven by distance travelled, blended
 * between walk, run, swim, fall and wave by weights that chase their targets.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = global.TW;
  var C = TW.core;
  var group = C.group, pivot = C.pivot, mesh = C.mesh, box = C.box;
  var cone = C.cone, tube = C.tube, torus = C.torus, link = C.link, poly = C.poly;
  var mat = C.mat, bake = C.bake, rand = C.rand, TAU = C.TAU;
  var clamp = T.MathUtils.clamp;
  var lerp = T.MathUtils.lerp;

  /* The explorer's colour sheet, kept in one place so a re-skin is one edit. */
  var SKIN = {
    coat: '#f2a63c',
    coatLight: '#ffcb5e',
    seam: '#c97f28',
    hood: '#e09030',
    skin: '#f5c49b',
    nose: '#eab08a',
    cheek: '#e79d8e',
    hair: '#4a3226',
    hat: '#3f7f74',
    hatDark: '#2e6159',
    hatLight: '#5aa79a',
    scarf: '#d95a4e',
    scarfDark: '#b3453d',
    trousers: '#33485f',
    trousersLight: '#44607a',
    boots: '#77523b',
    sole: '#4a4037',
    pack: '#3d7b6e',
    packDark: '#2a5a52',
    roll: '#e8d5a8',
    leather: '#e0c093',
    cream: '#fff1d4',
    brass: '#e2b25c',
    glass: '#bde8ee',
    eyes: '#272d31',
  };

  var ICO1 = new T.IcosahedronGeometry(1, 1);
  var ICO0 = new T.IcosahedronGeometry(1, 0);

  /** A scaled icosahedron — the character's universal soft volume. */
  function blob(parent, x, y, z, w, h, d, color, coarse) {
    var m = mesh(parent, coarse ? ICO0 : ICO1, color, x, y, z);
    m.scale.set(w, h, d);
    return m;
  }

  function ring(parent, x, y, z, radius, thickness, color, segments) {
    return mesh(parent, new T.TorusGeometry(radius, thickness, 4, segments || 12), color, x, y, z);
  }

  /* --- limbs ---------------------------------------------------------------- */

  function buildLeg(parent, side) {
    var thigh = pivot(parent, side * 0.072, 0.347, 0);
    tube(thigh, 0, -0.06, 0, 0.049, 0.135, SKIN.trousers, 7).scale.z = 0.94;
    box(thigh, side * 0.041, -0.055, 0.014, 0.014, 0.066, 0.046, SKIN.trousersLight);

    var knee = pivot(thigh, 0, -0.139, 0);
    tube(knee, 0, -0.056, 0, 0.043, 0.126, SKIN.trousers, 7).scale.z = 0.92;

    var ankle = pivot(knee, 0, -0.141, 0.005);
    tube(ankle, 0, 0.003, 0, 0.043, 0.084, SKIN.boots, 7);
    tube(ankle, 0, 0.036, 0, 0.046, 0.017, SKIN.coatLight, 7);
    blob(ankle, 0, -0.018, 0.033, 0.048, 0.041, 0.065, SKIN.boots);
    tube(ankle, 0, -0.058, 0.026, 0.048, 0.014, SKIN.sole, 8).scale.z = 1.4;
    for (var lace = 0; lace < 3; lace++) {
      link(ankle,
        [-0.017, 0.016 - lace * 0.014, 0.041 + lace * 0.009],
        [0.017, 0.016 - lace * 0.014, 0.041 + lace * 0.009], 0.0034, SKIN.leather, 4);
    }
    box(ankle, 0, 0.029, -0.04, 0.021, 0.025, 0.011, SKIN.leather);

    bake(thigh, true);
    bake(knee, true);
    bake(ankle, true);
    return { thigh: thigh, knee: knee, ankle: ankle, side: side };
  }

  function buildArm(parent, side) {
    var shoulder = pivot(parent, side * 0.166, 0.611, 0);
    blob(shoulder, 0, -0.014, 0, 0.055, 0.063, 0.052, SKIN.coat);
    cone(shoulder, 0, -0.073, 0, 0.042, 0.134, SKIN.coat, 7, 0.054);
    if (side < 0) blob(shoulder, -0.042, -0.047, 0.025, 0.012, 0.021, 0.024, SKIN.cream, true);

    var elbow = pivot(shoulder, 0, -0.137, 0);
    cone(elbow, 0, -0.04, 0, 0.035, 0.099, SKIN.coat, 7, 0.042);
    tube(elbow, 0, -0.09, 0, 0.038, 0.026, SKIN.seam, 7);

    var hand = pivot(elbow, 0, -0.12, 0.003);
    blob(hand, 0, 0, 0.003, 0.033, 0.042, 0.033, SKIN.skin);
    blob(hand, -side * 0.023, 0.01, 0.022, 0.018, 0.024, 0.019, SKIN.skin, true);

    bake(shoulder, true);
    bake(elbow, true);
    bake(hand, true);
    return { shoulder: shoulder, elbow: elbow, hand: hand, side: side };
  }

  /** The lantern the explorer carries. Its glass is switchable. */
  function buildLantern(parent) {
    var swing = pivot(parent, 0, -0.055, 0.01);
    var glassMat = mat(SKIN.glass, {
      emissive: '#ffdc92', emissiveIntensity: 0,
      transparent: true, opacity: 0.82, roughness: 0.25,
    });
    link(swing, [0, 0.06, 0], [0, -0.02, 0], 0.004, SKIN.brass, 4);
    torus(swing, 0, -0.03, 0, 0.022, 0.005, SKIN.brass, 8);
    var glass = mesh(swing, new T.CylinderGeometry(0.031, 0.036, 0.075, 6), glassMat, 0, -0.09, 0);
    glass.castShadow = false;
    cone(swing, 0, -0.045, 0, 0.045, 0.035, SKIN.brass, 6, 0.014);
    tube(swing, 0, -0.132, 0, 0.037, 0.014, SKIN.brass, 6);
    for (var post = 0; post < 3; post++) {
      var a = (post * TAU) / 3;
      link(swing, [Math.cos(a) * 0.031, -0.052, Math.sin(a) * 0.031],
        [Math.cos(a) * 0.035, -0.128, Math.sin(a) * 0.035], 0.0035, SKIN.brass, 3);
    }
    var flame = mesh(swing, new T.ConeGeometry(0.012, 0.03, 4),
      mat('#ffd070', { emissive: '#ffc247', emissiveIntensity: 0, transparent: true, opacity: 0.9, depthWrite: false }),
      0, -0.095, 0);
    flame.castShadow = false;
    swing.userData.glass = glassMat;
    swing.userData.flame = flame;
    swing.userData.setLit = function (on) {
      glassMat.emissiveIntensity = on ? 2.4 : 0;
      flame.material.emissiveIntensity = on ? 3.0 : 0;
      flame.visible = !!on;
    };
    swing.userData.setLit(false);
    return swing;
  }

  function buildPack(parent) {
    var pack = pivot(parent, 0, 0.163, -0.164);
    blob(pack, 0, 0, -0.024, 0.125, 0.139, 0.094, SKIN.pack);
    blob(pack, 0, 0.073, -0.078, 0.118, 0.055, 0.054, SKIN.packDark);
    blob(pack, 0, -0.055, -0.102, 0.08, 0.056, 0.028, '#458d80');
    for (var i = 0; i < 2; i++) {
      var sx = i ? 0.064 : -0.064;
      box(pack, sx, -0.006, -0.111, 0.016, 0.195, 0.012, SKIN.leather);
      box(pack, sx, -0.018, -0.121, 0.03, 0.026, 0.012, SKIN.brass);
      box(pack, sx, -0.018, -0.128, 0.015, 0.012, 0.004, SKIN.packDark);
    }
    /* the bedroll strapped across the top */
    var roll = tube(pack, 0, 0.142, -0.012, 0.046, 0.259, SKIN.roll, 10);
    roll.rotation.z = Math.PI / 2;
    for (var s = -1; s <= 1; s += 2) {
      var cap = ring(pack, s * 0.131, 0.142, -0.012, 0.028, 0.005, '#5a8f74');
      cap.rotation.y = Math.PI / 2;
      var inner = ring(pack, s * 0.132, 0.142, -0.012, 0.013, 0.004, '#5a8f74', 8);
      inner.rotation.y = Math.PI / 2;
      var strap = ring(pack, s * 0.08, 0.142, -0.012, 0.047, 0.006, SKIN.leather);
      strap.rotation.y = Math.PI / 2;
    }
    /* a rolled map and a tin mug clipped to the side */
    tube(pack, 0.133, -0.027, -0.016, 0.027, 0.106, '#e08a4c', 8);
    tube(pack, 0.133, 0.033, -0.016, 0.017, 0.027, SKIN.cream, 8);
    tube(pack, 0.133, 0.049, -0.016, 0.019, 0.012, SKIN.packDark, 8);
    box(pack, 0.127, -0.031, 0.007, 0.016, 0.037, 0.014, SKIN.leather);
    var mug = ring(pack, -0.131, -0.023, -0.02, 0.028, 0.005, SKIN.brass, 7);
    mug.scale.y = 1.25;
    bake(pack, true);
    return pack;
  }

  function buildHead(parent) {
    var head = pivot(parent, 0, 0.777, 0.008);
    blob(head, 0, 0, 0, 0.146, 0.149, 0.136, SKIN.skin);

    for (var s = -1; s <= 1; s += 2) {
      blob(head, s * 0.14, -0.006, 0.003, 0.028, 0.036, 0.025, SKIN.skin);       /* ear */
      blob(head, s * 0.152, -0.006, 0.015, 0.01, 0.02, 0.012, SKIN.nose, true);
      blob(head, s * 0.081, -0.021, 0.115, 0.025, 0.017, 0.008, SKIN.cheek);
      blob(head, s * 0.128, 0.048, 0.016, 0.021, 0.045, 0.037, SKIN.hair, true);
      link(head, [s * 0.071, 0.047, 0.119], [s * 0.035, 0.052, 0.134], 0.005, SKIN.hair, 4);
    }
    blob(head, 0, -0.017, 0.139, 0.018, 0.022, 0.027, SKIN.nose, true);

    /* a soft smile, as a tube along a curve */
    var smile = new T.CatmullRomCurve3([
      new T.Vector3(-0.026, -0.046, 0.126),
      new T.Vector3(0, -0.053, 0.137),
      new T.Vector3(0.026, -0.046, 0.126),
    ]);
    mesh(head, new T.TubeGeometry(smile, 8, 0.0035, 4, false), '#995f4b');

    /* eyes, each on its own pivot so they can blink */
    var eyes = [];
    for (var e = -1; e <= 1; e += 2) {
      var eye = pivot(head, e * 0.051, 0.01, 0.126);
      blob(eye, 0, 0, 0, 0.016, 0.023, 0.013, SKIN.eyes);
      blob(eye, -0.004, 0.007, 0.01, 0.005, 0.006, 0.0035, SKIN.cream, true);
      bake(eye, true);
      eyes.push(eye);
    }

    /* the hat */
    var hat = group(head, 0, 0.077, -0.009);
    hat.rotation.z = -0.065;
    tube(hat, 0, 0, 0, 0.147, 0.042, SKIN.hatDark, 12).scale.z = 0.96;
    tube(hat, 0, 0.013, 0, 0.15, 0.02, SKIN.hat, 12).scale.z = 0.96;
    mesh(hat, new T.SphereGeometry(0.147, 12, 5, 0, TAU, 0, Math.PI / 2), SKIN.hat, 0, 0.021, 0)
      .scale.set(1, 0.77, 0.96);
    for (var seam = 0; seam < 12; seam++) {
      var sa = (seam * Math.PI) / 6;
      link(hat, [Math.sin(sa) * 0.147, -0.012, Math.cos(sa) * 0.142],
        [Math.sin(sa) * 0.149, 0.02, Math.cos(sa) * 0.144], 0.0028, SKIN.hatLight, 4);
    }
    /* a leather patch on the brim */
    box(hat, 0.054, -0.001, 0.14, 0.034, 0.029, 0.007, SKIN.cream);
    box(hat, 0.054, -0.001, 0.145, 0.012, 0.018, 0.003, SKIN.hatDark);

    /* goggles pushed up onto the crown */
    var goggleMat = mat(SKIN.glass, { transparent: true, opacity: 0.75, roughness: 0.2 });
    for (var g2 = -1; g2 <= 1; g2 += 2) {
      var lens = tube(hat, g2 * 0.052, 0.085, 0.108, 0.038, 0.022, goggleMat, 10);
      lens.rotation.x = Math.PI / 2 - 0.35;
      lens.castShadow = false;
      var rim2 = ring(hat, g2 * 0.052, 0.085, 0.108, 0.04, 0.009, SKIN.brass, 10);
      rim2.rotation.x = -0.35;
    }
    box(hat, 0, 0.085, 0.112, 0.03, 0.014, 0.012, SKIN.leather);
    box(hat, 0, 0.055, -0.11, 0.16, 0.02, 0.05, SKIN.leather);

    /* the scarf, on its own pivot so it can trail */
    var scarf = pivot(head, 0, -0.13, 0);
    tube(scarf, 0, 0, 0, 0.115, 0.07, SKIN.scarf, 10).scale.z = 0.94;
    tube(scarf, 0, 0.03, 0, 0.108, 0.04, SKIN.scarfDark, 10).scale.z = 0.94;
    var tail = pivot(scarf, 0.06, -0.03, -0.09);
    box(tail, 0, -0.09, -0.02, 0.075, 0.19, 0.03, SKIN.scarf);
    box(tail, 0, -0.19, -0.03, 0.075, 0.03, 0.03, SKIN.scarfDark);
    bake(tail, true);

    bake(head, true);
    return { head: head, eyes: eyes, scarf: scarf, tail: tail };
  }

  /* --- assembly ------------------------------------------------------------- */

  function createExplorer() {
    var root = pivot(null);
    root.name = 'Explorer';
    var body = pivot(root);
    var torso = pivot(body, 0, 0.349, 0);

    /* the coat */
    var coat = cone(torso, 0, 0.151, 0, 0.165, 0.302, SKIN.coat, 8, 0.131);
    coat.scale.z = 0.87;
    tube(torso, 0, 0.009, 0, 0.166, 0.025, SKIN.seam, 8).scale.z = 0.87;
    tube(torso, 0, 0.313, 0, 0.08, 0.05, SKIN.cream, 8).scale.z = 0.88;
    blob(torso, 0, 0.281, -0.065, 0.108, 0.076, 0.075, SKIN.hood);
    box(torso, 0, 0.153, 0.138, 0.009, 0.261, 0.009, SKIN.seam);
    box(torso, 0, 0.214, 0.145, 0.014, 0.025, 0.009, SKIN.brass);
    for (var s = -1; s <= 1; s += 2) {
      box(torso, s * 0.079, 0.094, 0.13, 0.062, 0.06, 0.014, SKIN.hood);          /* pocket */
      box(torso, s * 0.079, 0.123, 0.141, 0.066, 0.017, 0.014, SKIN.coatLight);
      blob(torso, s * 0.079, 0.114, 0.151, 0.006, 0.006, 0.004, SKIN.brass, true);
      link(torso, [s * 0.092, 0.28, 0.076], [s * 0.099, 0.188, 0.129], 0.014, SKIN.packDark, 5);
      link(torso, [s * 0.099, 0.188, 0.129], [s * 0.121, 0.097, 0.101], 0.012, SKIN.packDark, 5);
      box(torso, s * 0.1, 0.192, 0.141, 0.033, 0.028, 0.011, SKIN.leather);
    }
    /* a little compass pinned to the chest */
    link(torso, [0.024, 0.295, 0.099], [0.052, 0.207, 0.144], 0.003, SKIN.hair, 4);
    var compass = tube(torso, 0.052, 0.204, 0.149, 0.023, 0.013, SKIN.brass, 10);
    compass.rotation.x = Math.PI / 2;
    var face = tube(torso, 0.052, 0.204, 0.158, 0.016, 0.006, SKIN.cream, 10);
    face.rotation.x = Math.PI / 2;
    link(torso, [0.043, 0.198, 0.163], [0.061, 0.21, 0.163], 0.003, SKIN.scarf, 3);

    var pack = buildPack(torso);
    var legL = buildLeg(body, -1);
    var legR = buildLeg(body, 1);
    var armL = buildArm(body, -1);
    var armR = buildArm(body, 1);
    var lantern = buildLantern(armL.hand);
    var headParts = buildHead(body);
    var head = headParts.head;
    var eyes = headParts.eyes;
    var scarf = headParts.scarf;
    var scarfTail = headParts.tail;

    bake(torso, true);

    /* --- animation state -------------------------------------------------- */

    var clock = 0;        /* internal seconds, used when no time is supplied */
    var gait = 0;         /* walk-cycle phase, driven by speed */
    var moveBlend = 0;    /* 0 idle .. 1 moving */
    var swimBlend = 0;
    var airBlend = 0;
    var waveTimer = 0;
    var waveClock = 0;
    var interacting = false;

    function wave() {
      waveTimer = 1.8;
      waveClock = 0;
    }

    /**
     * @param {number} dt
     * @param {object} state { time, speed, running, swimming, airborne, interacting }
     */
    function update(dt, state) {
      state = state || {};
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.08);
      clock += dt;
      var time = Number.isFinite(state.time) ? state.time : clock;
      var speed = Math.max(0, Number.isFinite(state.speed) ? state.speed : 0);
      var ease = 1 - Math.exp(-dt * 13);
      var running = !!state.running;

      moveBlend = lerp(moveBlend, clamp(speed / 1.4, 0, 1), ease);
      swimBlend = lerp(swimBlend, state.swimming ? 1 : 0, ease);
      airBlend = lerp(airBlend, state.airborne ? 1 : 0, ease);

      if (state.interacting && !interacting) wave();
      interacting = !!state.interacting;
      if (waveTimer > 0) {
        waveTimer = Math.max(0, waveTimer - dt);
        waveClock += dt;
      }
      var waveBlend = Math.min(clamp(waveClock / 0.16, 0, 1), clamp(waveTimer / 0.3, 0, 1));

      if (moveBlend > 0.005) {
        gait += dt * (running ? 10.5 : 7.6) * (0.65 + 0.35 * Math.min(speed / 3, 1));
      }

      var swing = (running ? 0.82 : 0.52) * moveBlend;
      var stroke = time * (clamp(speed / 1.4, 0, 1) > 0.1 ? 5.2 : 2.3);
      var breath = Math.sin(time * 2.1);

      /* whole-body bob, lean and roll */
      body.position.y =
        (Math.abs(Math.sin(gait)) * (running ? 0.035 : 0.019) * moveBlend + breath * 0.0035) * (1 - swimBlend) +
        Math.sin(time * 2.7) * 0.017 * swimBlend;
      body.rotation.x = lerp(-0.055 * moveBlend - 0.055 * airBlend, -0.27, swimBlend);
      body.rotation.z = Math.sin(gait) * 0.025 * moveBlend * (1 - swimBlend);
      torso.rotation.y = Math.sin(gait) * 0.06 * moveBlend * (1 - swimBlend);
      torso.scale.y = 1 + breath * 0.006 * (1 - moveBlend);

      /* legs: a sine for the hip, a clipped cosine for the knee */
      var legs = [legL, legR];
      for (var l = 0; l < 2; l++) {
        var leg = legs[l];
        var phase = gait + (leg.side < 0 ? Math.PI : 0);
        var hip = Math.sin(phase);
        var bend = Math.max(0, Math.cos(phase)) * (running ? 1 : 0.48) * moveBlend;

        leg.thigh.rotation.x = lerp(hip * swing, Math.sin(stroke + (leg.side * Math.PI) / 2) * 0.3 + 0.16, swimBlend);
        leg.thigh.rotation.x = lerp(leg.thigh.rotation.x, leg.side < 0 ? -0.42 : 0.2, airBlend);
        leg.thigh.rotation.z = leg.side * (0.014 + 0.026 * swimBlend);
        leg.knee.rotation.x = lerp(bend, 0.22 + Math.max(0, Math.sin(stroke + (leg.side * Math.PI) / 2)) * 0.23, swimBlend);
        leg.knee.rotation.x = lerp(leg.knee.rotation.x, leg.side < 0 ? 0.72 : 0.45, airBlend);
        leg.ankle.rotation.x = -0.16 * bend;
      }

      /* arms: counter-swing, breaststroke when swimming, up when falling */
      var arms = [armL, armR];
      for (var a = 0; a < 2; a++) {
        var arm = arms[a];
        var ap = gait + (arm.side < 0 ? Math.PI : 0);
        arm.shoulder.rotation.set(
          -Math.sin(ap) * swing * 0.83 - 0.06, 0,
          arm.side * (0.11 + 0.03 * breath * (1 - moveBlend))
        );
        arm.elbow.rotation.set(-0.1 - (running ? 0.42 : 0.1) * moveBlend, 0, 0);
        arm.hand.rotation.set(0, 0, 0);

        arm.shoulder.rotation.x = lerp(arm.shoulder.rotation.x, -1.16 + Math.cos(stroke) * 0.45, swimBlend);
        arm.shoulder.rotation.z = lerp(arm.shoulder.rotation.z, arm.side * (0.8 + Math.sin(stroke) * 0.36), swimBlend);
        arm.elbow.rotation.x = lerp(arm.elbow.rotation.x, -0.27 - Math.max(0, Math.cos(stroke)) * 0.7, swimBlend);
        arm.shoulder.rotation.z = lerp(arm.shoulder.rotation.z, arm.side * 0.6, airBlend);
        arm.shoulder.rotation.x = lerp(arm.shoulder.rotation.x, -0.6, airBlend);
      }

      /* the wave, layered on the right arm only */
      armR.shoulder.rotation.z = lerp(armR.shoulder.rotation.z, 2.47 + Math.sin(waveClock * 12) * 0.12, waveBlend);
      armR.shoulder.rotation.x = lerp(armR.shoulder.rotation.x, -0.16, waveBlend);
      armR.elbow.rotation.z = Math.sin(waveClock * 12) * 0.3 * waveBlend;
      armR.elbow.rotation.x = lerp(armR.elbow.rotation.x, -0.12, waveBlend);
      armR.hand.rotation.z = Math.sin(waveClock * 12 + 0.4) * 0.2 * waveBlend;

      /* the lantern hangs plumb-ish and swings with the stride */
      lantern.rotation.z = -armL.shoulder.rotation.z * 0.8 + Math.sin(gait + 0.6) * 0.14 * moveBlend;
      lantern.rotation.x = -armL.shoulder.rotation.x * 0.7 + Math.sin(gait) * 0.1 * moveBlend;

      /* head: idle drift, a slight tuck while waving */
      head.rotation.set(
        Math.sin(time * 0.9) * 0.019 * (1 - moveBlend) - 0.025 * moveBlend,
        Math.sin(time * 0.55) * 0.065 * (1 - moveBlend),
        -0.07 * waveBlend
      );

      /* blink on a 5.4 s cycle */
      var blinkCycle = (time + 1.21) % 5.4;
      var shut = Math.max(0, 1 - Math.abs(blinkCycle - 0.13) / 0.09);
      for (var e2 = 0; e2 < eyes.length; e2++) eyes[e2].scale.y = Math.max(0.08, 1 - shut);

      /* pack and scarf trail behind the motion */
      pack.rotation.x = Math.sin(gait - 0.5) * 0.025 * moveBlend + breath * 0.006;
      pack.rotation.z = -Math.sin(gait) * 0.025 * moveBlend;
      scarf.rotation.z = Math.sin(gait - 0.4) * 0.06 * moveBlend + Math.sin(time * 1.7) * 0.02;
      scarfTail.rotation.x = -0.25 * moveBlend - 0.1 + Math.sin(time * 3.1 + gait) * 0.16 * (0.3 + moveBlend);
      scarfTail.rotation.z = Math.sin(time * 2.3 + gait * 0.5) * 0.2 * (0.3 + moveBlend);
    }

    update(0, {});

    return {
      group: root,
      update: update,
      wave: wave,
      lantern: lantern,
      setLanternLit: lantern.userData.setLit,
    };
  }

  /* --- the destination marker ------------------------------------------------ */

  /** The golden pin that drops where you click. */
  function createWaypointMarker() {
    var g = pivot(null);
    g.name = 'Waypoint';
    var goldMat = mat('#ffd76b', { emissive: '#f5a62b', emissiveIntensity: 0.3, roughness: 0.6 });

    var shadowRing = mesh(g, new T.TorusGeometry(0.325, 0.029, 4, 28), '#544c38', 0, 0.019, 0);
    shadowRing.rotation.x = Math.PI / 2;
    shadowRing.scale.z = 0.34;
    var ring2 = mesh(g, new T.TorusGeometry(0.324, 0.018, 4, 28), goldMat, 0, 0.041, 0);
    ring2.rotation.x = Math.PI / 2;

    var float = pivot(g, 0, 0.29, 0);
    mesh(float, new T.OctahedronGeometry(0.085), goldMat).scale.y = 1.5;
    var spark = blob(float, 0, 0.018, 0.004, 0.036, 0.042, 0.036, '#fff4c8', true);

    C.dyn(g, function (t) {
      float.position.y = 0.29 + Math.sin(t * 3.7) * 0.025;
      float.rotation.y = t * 0.55;
      var pulse = 1 + Math.sin(t * 3.7) * 0.045;
      ring2.scale.set(pulse, pulse, 1);
    });
    g.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
    return g;
  }

  /* --- the companion --------------------------------------------------------- */

  /**
   * A small round creature that trails the explorer at a polite distance,
   * hops when it has to catch up, and sits down when you stop. It has its own
   * spherical walker so it never clips through trees either.
   */
  function createCompanion(opts) {
    var body = pivot(null);
    body.name = 'Companion';

    var bob = pivot(body);
    var shell = blob(bob, 0, 0.17, 0, 0.19, 0.16, 0.21, '#8fd8c4');
    blob(bob, 0, 0.14, 0.06, 0.14, 0.11, 0.16, '#b6ecd8');
    /* a leafy sprout on top */
    tube(bob, 0, 0.31, -0.02, 0.014, 0.1, '#5f9a6a', 5);
    var leafA = mesh(bob, poly([[0, 0.36, -0.02], [0.11, 0.44, 0.02], [0.02, 0.4, 0.05]]),
      mat('#6fbf7c', { side: T.DoubleSide }));
    var leafB = mesh(bob, poly([[0, 0.36, -0.02], [-0.1, 0.42, -0.05], [-0.02, 0.39, -0.08]]),
      mat('#5fae6c', { side: T.DoubleSide }));
    leafA.castShadow = leafB.castShadow = false;

    var head = pivot(bob, 0, 0.24, 0.14);
    blob(head, 0, 0, 0, 0.12, 0.11, 0.11, '#a8e2d0');
    var eyes = [];
    for (var e = -1; e <= 1; e += 2) {
      var eye = pivot(head, e * 0.055, 0.02, 0.085);
      blob(eye, 0, 0, 0, 0.021, 0.026, 0.014, '#25313a');
      blob(eye, -0.005, 0.008, 0.009, 0.006, 0.007, 0.004, '#ffffff', true);
      eyes.push(eye);
    }
    blob(head, 0, -0.02, 0.105, 0.02, 0.015, 0.014, '#f0a08c', true);
    /* two little ear fins */
    for (var f = -1; f <= 1; f += 2) {
      var fin = mesh(head, poly([[f * 0.1, 0.02, -0.02], [f * 0.19, 0.11, -0.05], [f * 0.11, -0.03, -0.06]]),
        mat('#7ecdb8', { side: T.DoubleSide }));
      fin.castShadow = false;
    }
    /* stubby feet */
    var feet = [];
    for (var ft = -1; ft <= 1; ft += 2) {
      var foot = pivot(bob, ft * 0.1, 0.05, 0.02);
      blob(foot, 0, 0, 0.02, 0.055, 0.04, 0.075, '#6fbfa8');
      feet.push(foot);
    }
    var glowMat = mat('#bff5e4', {
      emissive: '#8ff0d4', emissiveIntensity: 0.4,
      transparent: true, opacity: 0.85, roughness: 1,
    });
    var spot = mesh(bob, new T.IcosahedronGeometry(0.045, 0), glowMat, 0.09, 0.27, -0.1);
    spot.castShadow = false;
    var spot2 = mesh(bob, new T.IcosahedronGeometry(0.032, 0), glowMat, -0.11, 0.22, -0.12);
    spot2.castShadow = false;

    var walker = new TW.walk.Walker({
      radius: opts.radius,
      start: opts.start.clone(),
      colliders: opts.colliders,
      surfaceRadius: opts.surfaceRadius,
      isWater: opts.isWater,
    });
    walker.walkSpeed = 3.0;
    walker.runSpeed = 5.4;
    walker.swimSpeed = 3.2;

    var hop = 0;
    var idle = 0;

    /**
     * @param {number} dt
     * @param {THREE.Vector3} leaderNormal  where the explorer is
     * @param {number} time
     */
    function update(dt, leaderNormal, time) {
      var gap = TW.walk.arcLength(walker.normal, leaderNormal, opts.radius);

      /* Follow only when the explorer has got far enough ahead; stop when
       * close, so the companion does not jitter around your feet. */
      if (gap > 2.4) {
        walker.destination(leaderNormal);
      } else if (gap < 1.3 && walker.target) {
        walker.stop();
      }
      var moved = walker.update(dt, { running: gap > 5 });
      var speed = dt > 0 ? moved.moved / dt : 0;

      body.position.copy(walker.normal)
        .multiplyScalar(opts.surfaceRadius(walker.normal) + (walker.swimming ? -0.1 : 0.02));
      body.quaternion.copy(walker.quaternion);

      if (speed > 0.4) {
        idle = 0;
        hop += dt * (6 + speed);
        var lift = Math.abs(Math.sin(hop));
        bob.position.y = lift * 0.12;
        bob.rotation.x = -lift * 0.22;
        for (var i = 0; i < feet.length; i++) feet[i].rotation.x = Math.sin(hop + i * Math.PI) * 0.5;
        head.rotation.x = lift * 0.1;
      } else {
        idle += dt;
        bob.position.y = C.damp(bob.position.y, Math.sin(time * 2.2) * 0.012, 6, dt);
        bob.rotation.x = C.damp(bob.rotation.x, 0, 6, dt);
        head.rotation.y = Math.sin(time * 0.7) * 0.4;
        head.rotation.x = Math.sin(time * 1.1) * 0.1;
        for (var f2 = 0; f2 < feet.length; f2++) feet[f2].rotation.x = C.damp(feet[f2].rotation.x, 0, 6, dt);
      }

      leafA.rotation.z = Math.sin(time * 2.4) * 0.25;
      leafB.rotation.z = Math.sin(time * 2.4 + 1.1) * 0.2;
      glowMat.emissiveIntensity = 0.35 + Math.sin(time * 1.6) * 0.2;

      var blink = (time + 2.7) % 4.2;
      var shut = Math.max(0, 1 - Math.abs(blink - 0.1) / 0.08);
      for (var e2 = 0; e2 < eyes.length; e2++) eyes[e2].scale.y = Math.max(0.1, 1 - shut);
    }

    function teleportTo(normal) {
      walker.normal.copy(normal);
      walker.stop();
    }

    return { group: body, update: update, walker: walker, teleportTo: teleportTo, glow: glowMat };
  }

  TW.explorer = {
    SKIN: SKIN,
    create: createExplorer,
    createWaypointMarker: createWaypointMarker,
    createCompanion: createCompanion,
  };
})(typeof window !== 'undefined' ? window : this);
