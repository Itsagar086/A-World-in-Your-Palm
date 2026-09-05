/* =============================================================================
 * A World in Your Palm — 90-app.js
 * Wiring: renderer, cameras, input, HUD, persistence, and the frame loop.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = global.TW;
  var C = TW.core;
  var PLANET = TW.planet;
  var WALK = TW.walk;
  var clamp = T.MathUtils.clamp;
  var damp = T.MathUtils.damp;

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('world');

  /* --- renderer ------------------------------------------------------------- */

  var renderer;
  try {
    renderer = new T.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
  } catch (err) {
    $('fallback').hidden = false;
    $('loading').hidden = true;
    throw err;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; /* only used if post is off */
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(42, 1, 0.15, 260);

  var lighting = TW.render.createLighting(scene);

  /* --- world ----------------------------------------------------------------- */

  var world = PLANET.build({ terrainDetail: 40, scatter: 1650 });
  scene.add(world.root);
  var sky = PLANET.buildSky(scene);
  var bodies = TW.render.createSunAndMoon(scene);

  /* Props dither out of the way when they block the view of the explorer. */
  var occlusionTarget = { value: new T.Vector3() };
  var occlusionEnabled = { value: 0 };
  TW.render.installOcclusion(world.ctx.root, occlusionTarget, occlusionEnabled);

  var explorer = TW.explorer.create();
  scene.add(explorer.group);

  /* The one dynamic light in the game. It rides in the explorer's hand and
   * only wakes at dusk, which is what makes walking the night side worth
   * doing rather than merely possible. */
  var lanternLight = new T.PointLight('#ffd08a', 0, 7.5, 1.7);
  lanternLight.position.set(0, -0.09, 0);
  lanternLight.castShadow = false;
  explorer.lantern.add(lanternLight);

  var spawn = PLANET.normalAt('mosswood', 0, -0.15);
  var walker = new WALK.Walker({
    radius: PLANET.RADIUS,
    start: spawn,
    colliders: world.colliders,
    surfaceRadius: PLANET.surfaceRadius,
    isWater: PLANET.isWater,
  });
  walker.forward.copy(PLANET.BIOMES[0].south);

  var companion = TW.explorer.createCompanion({
    radius: PLANET.RADIUS,
    start: WALK.advance(spawn, PLANET.BIOMES[0].east, 1.2, PLANET.RADIUS),
    colliders: world.colliders,
    surfaceRadius: PLANET.surfaceRadius,
    isWater: PLANET.isWater,
  });
  scene.add(companion.group);

  var waypoint = TW.explorer.createWaypointMarker();
  waypoint.visible = false;
  scene.add(waypoint);

  /* Open on a bright mid-morning over Cubbon Woods, wherever that happens to fall
   * on the sun's orbit, and build the navigation graph now rather than on the
   * player's first click — it is a ~100 ms job and it should not land mid-walk. */
  lighting.startAt(spawn, 0.66);
  WALK.findRoute(spawn, PLANET.normalAt('mosswood', 3, 3), world.colliders, PLANET.RADIUS);

  /* The gold ring and soft shadow that sit under the explorer's feet. */
  var footRing = new T.Mesh(
    new T.RingGeometry(0.31, 0.36, 32),
    new T.MeshBasicMaterial({ color: '#e9d48e', transparent: true, opacity: 0.66, side: T.DoubleSide, depthWrite: false })
  );
  footRing.geometry.rotateX(-Math.PI / 2);
  scene.add(footRing);
  var footShadow = new T.Mesh(
    new T.CircleGeometry(0.29, 24),
    new T.MeshBasicMaterial({ color: '#172a26', transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide })
  );
  footShadow.geometry.rotateX(-Math.PI / 2);
  scene.add(footShadow);

  /* The post chain needs WebGL2 for a multisampled half-float target. On
   * anything older we fall back to rendering straight to the screen with
   * three's own tone mapping — no bloom, but a working game. */
  var post;
  try {
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 required for the post chain');
    post = TW.render.createPost(renderer, scene, camera);
  } catch (err) {
    console.warn('A World in Your Palm: falling back to direct rendering.', err);
    post = {
      render: function () {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      },
      setSize: function () {},
      composite: { uniforms: { nightAmount: { value: 0 }, bloomStrength: { value: 0 } } },
      enabled: false,
      bloomEnabled: false,
    };
  }

  /* --- persistence ------------------------------------------------------------ */

  var SAVE_KEY = new URLSearchParams(location.search).has('qa')
    ? 'tiny-world-qa-v1'
    : 'tiny-world-save-v1';

  var found = new Set();
  var collected = new Set();
  var savedDistance = 0;

  try {
    var raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.wonders)) {
        raw.wonders.forEach(function (id) {
          if (world.landmarks.some(function (l) { return l.id === id; })) found.add(id);
        });
      }
      if (Array.isArray(raw.wisps)) {
        raw.wisps.forEach(function (id) {
          if (world.wisps.some(function (w) { return w.id === id; })) collected.add(id);
        });
      }
      if (Number.isFinite(raw.walked)) savedDistance = raw.walked;
    }
  } catch (e) { /* a corrupt save is not worth a crash */ }

  var TOTAL_WONDERS = world.landmarks.length;
  var TOTAL_WISPS = world.wisps.length;

  /* Replay completed wonders so the world loads in the state you left it. */
  world.landmarks.forEach(function (lm) {
    if (!found.has(lm.id)) return;
    lm.completed = true;
    try { if (lm.activate) lm.activate(); } catch (e) { console.error('replay failed', lm.id, e); }
  });
  world.wisps.forEach(function (w) { if (collected.has(w.id)) w.taken = true; });

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        wonders: Array.from(found),
        wisps: Array.from(collected),
        walked: Math.round(walker.distance + savedDistance),
      }));
    } catch (e) { /* private browsing, quota — silently carry on */ }
  }

  /* --- runtime state ----------------------------------------------------------- */

  var audio = TW.audio.create();
  var soundOn = false;

  var view = 'globe';
  var globeSpin = { theta: -0.42, phi: 0.9 };
  var globeZoom = 1;
  var globeFit = 55;
  var followDistance = 12.8;
  var followPitch = 0.88;
  var followOrbit = PLANET.BIOMES[0].south.clone();

  var lookAtPoint = new T.Vector3();
  var firstFrame = true;
  var aspect = 1;

  var clockTime = 0;      /* seconds since load, pauses when hidden */
  var animTime = 0;       /* the same, but frozen by reduced-motion */
  var lastFrame = performance.now();
  var lastInteract = -10;      /* simulation time — drives the wave animation */
  var lastInteractReal = -1e6; /* wall clock — debounces the key, so a slow
                                  frame rate never swallows a keypress */
  var lastInputAt = 0;
  var shadowStamp = 0;
  var toastUntil = 0;
  var telemetryStamp = 0;

  var nearbyWonder = null;
  var currentBiome = 'mosswood';
  var moving = false;
  var pageHidden = document.hidden;
  var photoMode = false;
  var captureRequested = false;

  var coarsePointer = matchMedia('(pointer: coarse)').matches;
  var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) {
    reducedMotion = e.matches;
  });

  var maxPixelRatio = Math.min(devicePixelRatio || 1, coarsePointer ? 1.25 : 1.6);
  var frames = 0, frameStamp = performance.now(), fps = 60, downgrades = 0;

  var keys = new Set();
  var tappedKeys = new Set();
  var stick = { x: 0, y: 0, id: null };
  var stickLatch = { x: 0, y: 0 };

  var cameraRight = new T.Vector3();
  var cameraUp = new T.Vector3();
  var UP = PLANET.UP;

  /* --- layout ------------------------------------------------------------------ */

  function resize() {
    var w = Math.max(1, innerWidth);
    var h = Math.max(1, innerHeight);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    var touch = coarsePointer || w < 650;
    $('walk-hint-primary').textContent = touch ? 'Tap the ground to wander' : 'Click anywhere to wander';
    $('walk-hint-secondary').textContent = touch ? 'Drag to look · Pinch to zoom' : 'Drag to orbit · Scroll to zoom';

    /* Frame the whole globe with a little air around it. */
    var vFov = Math.atan(Math.tan((21 * Math.PI) / 180) * Math.min(1, aspect));
    globeFit = ((PLANET.RADIUS + 3.8) / Math.sin(vFov)) * 1.1;

    var ratio = Math.min(maxPixelRatio, Math.sqrt(2300000 / (w * h)));
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    post.setSize(w, h, ratio);
    renderer.shadowMap.needsUpdate = true;
  }
  addEventListener('resize', resize, { passive: true });

  /* --- HUD --------------------------------------------------------------------- */

  function setView(next) {
    view = next;
    document.body.classList.toggle('is-follow', view === 'follow');
    var label = view === 'globe' ? 'Follow explorer' : 'Globe view';
    $('view-button').setAttribute('aria-label', label);
    $('view-button').title = label + ' (M)';
    $('view-button').setAttribute('aria-pressed', String(view === 'follow'));
    if (next === 'globe') {
      /* Enter globe view looking at wherever the explorer happens to be. */
      globeSpin.theta = Math.atan2(walker.normal.x, walker.normal.z);
      globeSpin.phi = Math.acos(clamp(walker.normal.y, -0.95, 0.95));
    }
    lastInputAt = clockTime;
  }

  function toast(message, kind, seconds) {
    var label = document.createElement('strong');
    label.textContent = kind || 'A LITTLE DISCOVERY';
    $('toast').replaceChildren(label, document.createTextNode(message));
    $('toast').classList.add('visible');
    toastUntil = clockTime + (seconds || 4.8);
  }

  function cancelJourney() {
    walker.stop();
    waypoint.visible = false;
    $('journey').hidden = true;
  }

  function travelTo(normal, landmarkId) {
    walker.destination(normal, landmarkId);
    lastInputAt = clockTime;
    setView('follow');
    waypoint.visible = true;
    waypoint.position.copy(normal).multiplyScalar(PLANET.surfaceRadius(normal) + 0.06);
    waypoint.quaternion.setFromUnitVectors(UP, normal);
    var lm = world.landmarks.find(function (l) { return l.id === landmarkId; });
    $('journey-label').textContent = lm
      ? 'Wandering to ' + PLANET.BY_ID[lm.biome].name
      : 'Taking the scenic route';
    $('journey').hidden = false;
  }

  function refreshProgress() {
    $('progress-number').innerHTML = found.size + ' <span>/ ' + TOTAL_WONDERS + '</span>';
    $('journal-button').setAttribute('aria-label',
      'Open field journal, ' + found.size + ' of ' + TOTAL_WONDERS + ' discoveries');
    $('journal-progress-fill').style.width = (found.size / TOTAL_WONDERS) * 100 + '%';
    $('wisp-count').textContent = collected.size + ' / ' + TOTAL_WISPS;
    $('stat-wisps').textContent = collected.size + ' / ' + TOTAL_WISPS;
    $('stat-walked').textContent = Math.round(walker.distance + savedDistance) + ' m';
    $('stat-regions').textContent = visitedRegions.size + ' / ' + PLANET.BIOMES.length;

    var entries = $('journal-list').children;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var done = found.has(entry.dataset.landmark);
      entry.classList.toggle('completed', done);
      entry.querySelector('.entry-number').textContent =
        done ? '✓' : String(Number(entry.dataset.index) + 1).padStart(2, '0');
      entry.querySelector('.entry-copy span').textContent =
        done ? 'Discovered · Visit again' : entry.dataset.action;
    }
  }

  var visitedRegions = new Set(['mosswood']);

  /* Build the journal, one row per region that owns a wonder. */
  PLANET.BIOMES.forEach(function (biome) {
    var lm = world.landmarks.find(function (l) { return l.biome === biome.id; });
    if (!lm) return;
    var entry = document.createElement('button');
    entry.className = 'journal-entry';
    entry.dataset.landmark = lm.id;
    entry.dataset.index = biome.index;
    entry.dataset.action = lm.action;
    entry.style.setProperty('--entry-color', biome.accent);

    var number = document.createElement('span');
    number.className = 'entry-number';
    var copy = document.createElement('span');
    copy.className = 'entry-copy';
    var name = document.createElement('strong');
    name.textContent = biome.name;
    var status = document.createElement('span');
    copy.append(name, status);
    var arrow = document.createElement('span');
    arrow.className = 'entry-arrow';
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    entry.append(number, copy, arrow);
    entry.setAttribute('aria-label', 'Walk to ' + biome.name);
    entry.addEventListener('click', function () {
      $('journal').close();
      travelTo(lm.normal, lm.id);
      canvas.focus({ preventScroll: true });
    });
    $('journal-list').append(entry);
  });

  /* --- confetti ----------------------------------------------------------------- */

  var confetti = [];
  var confettiGeo = new T.IcosahedronGeometry(0.045, 0);
  var confettiMats = ['#f4d98d', '#add798', '#f1ba9b', '#a1d6d8', '#c8a8e8']
    .map(function (c) { return new T.MeshBasicMaterial({ color: c }); });

  function burstConfetti(normal, big) {
    var count = big ? 80 : 24;
    var east = WALK.tangent(new T.Vector3(1, 0.3, 0), normal);
    var north = new T.Vector3().crossVectors(east, normal).normalize();
    for (var i = 0; i < count; i++) {
      var m = new T.Mesh(confettiGeo, confettiMats[i % confettiMats.length]);
      m.position.copy(normal).multiplyScalar(PLANET.surfaceRadius(normal) + 0.5);
      var a = i * 2.399;
      var spread = big ? 2.8 : 1;
      var velocity = normal.clone().multiplyScalar(1.6 + Math.random() * 1.9)
        .addScaledVector(east, Math.cos(a) * spread * Math.random())
        .addScaledVector(north, Math.sin(a) * spread * Math.random());
      scene.add(m);
      confetti.push({ mesh: m, velocity: velocity, normal: normal.clone(), age: 0, life: big ? 3.1 : 1.6 });
    }
  }

  /* --- interaction --------------------------------------------------------------- */

  function interact() {
    if (!nearbyWonder || $('journal').open || $('help').open) return;
    if (performance.now() - lastInteractReal < 700) return;
    lastInteractReal = performance.now();
    lastInteract = clockTime;
    setView('follow');
    cancelJourney();
    explorer.wave();

    var lm = nearbyWonder;
    var seenBefore = found.has(lm.id);
    var message;
    try {
      message = lm.activate ? lm.activate() : null;
    } catch (e) {
      console.error('Wonder failed', lm.id, e);
      toast('This little wonder needs another try.', 'ONE MOMENT');
      return;
    }

    found.add(lm.id);
    lm.completed = true;
    save();
    refreshProgress();

    var completedAll = !seenBefore && found.size === TOTAL_WONDERS;
    burstConfetti(lm.normal, completedAll);
    audio.chime(PLANET.BY_ID[lm.biome].index, completedAll);

    if (completedAll) {
      toast('Eight small wonders, all awake. One very well-travelled explorer.',
        'A WHOLE WORLD OF WONDER', 8);
    } else {
      toast(typeof message === 'string' ? message : lm.description || 'Something here feels brighter.',
        seenBefore ? 'HELLO AGAIN' : PLANET.BY_ID[lm.biome].name.toUpperCase() + ' · DISCOVERED');
    }
  }

  function checkWisps() {
    for (var i = 0; i < world.wisps.length; i++) {
      var w = world.wisps[i];
      if (w.taken) continue;
      if (WALK.arcLength(walker.normal, w.normal, PLANET.RADIUS) > 1.25) continue;
      w.taken = true;
      collected.add(w.id);
      save();
      refreshProgress();
      audio.sparkle(collected.size);
      burstConfetti(w.normal, false);
      if (collected.size === TOTAL_WISPS) {
        toast('Every wisp on the planet, safely in your lantern.', 'ALL WISPS FOUND', 6);
      } else {
        toast('A wisp drifts into your lantern. ' + collected.size + ' of ' + TOTAL_WISPS + '.',
          'A LITTLE LIGHT', 3);
      }
      break;
    }
  }

  function goHome() {
    cancelJourney();
    walker.reset();
    followOrbit.copy(PLANET.BIOMES[0].south);
    walker.forward.copy(followOrbit);
    companion.teleportTo(WALK.advance(walker.normal, PLANET.BIOMES[0].east, 1.2, PLANET.RADIUS));
    setView('follow');
    toast('Back where the trail began.', PLANET.BIOMES[0].name.toUpperCase(), 3);
  }

  function doJump() {
    if (walker.jump()) {
      audio.jump();
      lastInputAt = clockTime;
      setView('follow');
    }
  }

  /* --- buttons ------------------------------------------------------------------- */

  $('interact-button').addEventListener('click', interact);
  $('cancel-journey').addEventListener('click', cancelJourney);
  $('view-button').addEventListener('click', function () { setView(view === 'globe' ? 'follow' : 'globe'); });
  $('journal-button').addEventListener('click', function () {
    keys.clear();
    stick.x = stick.y = 0;
    refreshProgress();
    $('journal').showModal();
  });
  $('help-button').addEventListener('click', function () {
    keys.clear();
    $('help').showModal();
  });
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { $(b.dataset.close).close(); });
  });
  $('start-exploring').addEventListener('click', function () {
    $('help').close();
    setView('follow');
    canvas.focus({ preventScroll: true });
  });
  [$('help'), $('journal')].forEach(function (dialog) {
    dialog.addEventListener('click', function (e) {
      if (e.target !== dialog) return;
      var r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
  });

  $('sound-button').addEventListener('click', async function () {
    soundOn = !soundOn;
    audio.setEnabled(soundOn);
    if (soundOn && (await audio.unlock()) === false) {
      soundOn = false;
      audio.setEnabled(false);
      toast('Sound is unavailable in this browser.', 'SOUND', 3);
    }
    $('sound-button').setAttribute('aria-pressed', String(soundOn));
    $('sound-button').setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound');
  });

  var PHASE_ORDER = TW.render.PHASE_ORDER;
  var PHASE_LABEL = { auto: 'Auto', day: 'Day', dusk: 'Dusk', night: 'Night' };
  function cycleTime() {
    var i = PHASE_ORDER.indexOf(lighting.state.phase);
    var next = PHASE_ORDER[(i + 1) % PHASE_ORDER.length];
    lighting.setPhase(next);
    $('time-label').textContent = PHASE_LABEL[next];
    $('time-button').setAttribute('aria-label', 'Time of day: ' + PHASE_LABEL[next]);
    renderer.shadowMap.needsUpdate = true;
    toast(next === 'auto' ? 'Time flows again. A full day takes about seven minutes.'
      : 'The sky holds at ' + PHASE_LABEL[next].toLowerCase() + '.', 'TIME OF DAY', 2.6);
  }
  $('time-button').addEventListener('click', cycleTime);

  function setPhotoMode(on) {
    photoMode = !!on;
    document.body.classList.toggle('photo-mode', photoMode);
    $('photo-button').setAttribute('aria-pressed', String(photoMode));
    if (photoMode) toast('Press C to save a picture, P to come back.', 'PHOTO MODE', 3.4);
  }
  $('photo-button').addEventListener('click', function () { setPhotoMode(!photoMode); });
  $('capture-button').addEventListener('click', function () { captureRequested = true; });
  $('exit-photo').addEventListener('click', function () { setPhotoMode(false); });
  $('jump-button').addEventListener('click', doJump);

  /* --- keyboard -------------------------------------------------------------------- */

  var MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  var HANDLED = MOVE_KEYS.concat([' ', 'shift', 'e', 'm', 'j', 'n', 'p', 'c', 'home', 'escape']);

  addEventListener('keydown', function (e) {
    if ($('journal').open || $('help').open) return;
    var key = e.key.toLowerCase();
    if (HANDLED.indexOf(key) >= 0) {
      if (e.target !== canvas && e.target instanceof HTMLButtonElement && key === ' ') return;
      e.preventDefault();
      lastInputAt = clockTime;
    }
    if (MOVE_KEYS.indexOf(key) >= 0 || key === 'shift') {
      keys.add(key);
      tappedKeys.add(key);
      if (key !== 'shift') {
        setView('follow');
        canvas.focus({ preventScroll: true });
      }
    }
    if (e.repeat) return;
    if (key === ' ') doJump();
    else if (key === 'e') interact();
    else if (key === 'm') setView(view === 'globe' ? 'follow' : 'globe');
    else if (key === 'j') { refreshProgress(); $('journal').showModal(); keys.clear(); }
    else if (key === 'n') cycleTime();
    else if (key === 'p') setPhotoMode(!photoMode);
    else if (key === 'c') { if (photoMode) captureRequested = true; }
    else if (key === 'home') goHome();
    else if (key === 'escape') { if (photoMode) setPhotoMode(false); else cancelJourney(); }
  });
  addEventListener('keyup', function (e) { keys.delete(e.key.toLowerCase()); });
  addEventListener('blur', function () {
    keys.clear();
    tappedKeys.clear();
    stick.x = stick.y = stickLatch.x = stickLatch.y = 0;
  });

  /* --- pointer ---------------------------------------------------------------------- */

  var pointers = new Map();
  var dragOrigin = null;
  var dragDistance = 0;
  var pinchDistance = 0;
  var raycaster = new T.Raycaster();

  canvas.addEventListener('pointerdown', function (e) {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastInputAt = clockTime;
    if (pointers.size === 1) {
      dragOrigin = { x: e.clientX, y: e.clientY };
      dragDistance = 0;
    } else {
      var pts = Array.from(pointers.values());
      pinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      dragDistance = 100; /* a two-finger gesture is never a tap */
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId)) return;
    var prev = pointers.get(e.pointerId);
    var dx = e.clientX - prev.x;
    var dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragDistance += Math.hypot(dx, dy);
    lastInputAt = clockTime;

    if (pointers.size > 1) {
      var pts = Array.from(pointers.values());
      var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDistance > 0) zoomBy(pinchDistance / d);
      pinchDistance = d;
      return;
    }
    if (dragDistance < 4) return;
    canvas.classList.add('dragging');
    if (view === 'globe') {
      globeSpin.theta -= dx * 0.006;
      globeSpin.phi = clamp(globeSpin.phi - dy * 0.005, 0.08, Math.PI - 0.08);
    } else {
      followOrbit.applyAxisAngle(walker.normal, -dx * 0.006);
      followPitch = clamp(followPitch + dy * 0.004, 0.34, 1.28);
    }
  });

  canvas.addEventListener('pointerup', function (e) {
    var wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    canvas.classList.remove('dragging');
    if (dragDistance < 6 && wasSingle && dragOrigin && !photoMode) {
      var rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      ), camera);
      var hits = raycaster.intersectObjects([world.terrain, world.sea], false);
      if (hits.length) {
        var point = hits[0].point.clone().normalize();
        /* Clicking near a wonder means "walk to that wonder". */
        var lm = world.landmarks.find(function (l) {
          return WALK.arcLength(point, l.normal, PLANET.RADIUS) < 0.8;
        });
        travelTo(lm ? lm.normal : point, lm ? lm.id : null);
      }
    }
    if (!pointers.size) dragOrigin = null;
  });

  canvas.addEventListener('pointercancel', function (e) {
    pointers.delete(e.pointerId);
    dragOrigin = null;
    canvas.classList.remove('dragging');
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function zoomBy(factor) {
    if (view === 'globe') globeZoom = clamp(globeZoom * factor, 0.72, 1.6);
    else followDistance = clamp(followDistance * factor, 5.0, 25);
    lastInputAt = clockTime;
  }
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoomBy(Math.exp(clamp(e.deltaY, -120, 120) * 0.0017));
  }, { passive: false });

  /* --- touch joystick ---------------------------------------------------------------- */

  var joystick = $('joystick');
  function readStick(e) {
    var r = joystick.getBoundingClientRect();
    var dx = e.clientX - r.x - r.width / 2;
    var dy = e.clientY - r.y - r.height / 2;
    var len = Math.hypot(dx, dy);
    var scale = Math.min(1, 32 / (len || 1));
    stick.x = (dx * scale) / 32;
    stick.y = (-dy * scale) / 32;
    stickLatch.x = stick.x;
    stickLatch.y = stick.y;
    $('joystick-knob').style.transform = 'translate(' + dx * scale + 'px,' + dy * scale + 'px)';
  }
  joystick.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    stick.id = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    readStick(e);
    setView('follow');
    cancelJourney();
  });
  joystick.addEventListener('pointermove', function (e) {
    if (stick.id === e.pointerId) readStick(e);
  });
  ['pointerup', 'pointercancel'].forEach(function (type) {
    joystick.addEventListener(type, function () {
      stick.id = null;
      stick.x = stick.y = 0;
      $('joystick-knob').style.transform = 'translate(0,0)';
    });
  });

  /* --- camera ------------------------------------------------------------------------ */

  function updateCamera(dt) {
    var target, look, up;
    if (view === 'globe') {
      target = new T.Vector3().setFromSphericalCoords(globeFit * globeZoom, globeSpin.phi, globeSpin.theta);
      look = new T.Vector3();
      up = UP;
    } else {
      followOrbit.copy(WALK.tangent(followOrbit, walker.normal));
      var dist = followDistance * (aspect < 0.65 ? 1.13 : 1);
      target = walker.position
        .addScaledVector(walker.normal, Math.sin(followPitch) * dist)
        .addScaledVector(followOrbit, Math.cos(followPitch) * dist);
      look = walker.normal.clone().multiplyScalar(PLANET.surfaceRadius(walker.normal) + 0.6);
      up = walker.normal;
    }
    var ease = firstFrame || reducedMotion ? 1 : 1 - Math.exp(-dt * 5.2);
    camera.position.lerp(target, ease);
    lookAtPoint.lerp(look, ease);
    camera.up.lerp(up, ease).normalize();
    camera.lookAt(lookAtPoint);
    camera.updateMatrixWorld();
  }

  /* --- per-frame HUD ------------------------------------------------------------------ */

  var compassNeedle = $('compass-needle');

  function updateHud() {
    /* the nearest wonder we are standing in */
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < world.landmarks.length; i++) {
      var lm = world.landmarks[i];
      var d = WALK.arcLength(walker.normal, lm.normal, PLANET.RADIUS);
      if (d < lm.radius && d < bestDistance) { best = lm; bestDistance = d; }
    }
    nearbyWonder = best;
    $('interact-button').hidden = !best;
    if (best) {
      $('interaction-label').textContent = best.action;
      $('interaction-kind').textContent = best.completed ? 'A FAMILIAR PLACE' : 'A SMALL WONDER';
      $('interact-button').setAttribute('aria-label', best.action);
    }

    /* the region we are standing in */
    var biome = PLANET.biomeAt(walker.normal);
    if (currentBiome !== biome.id) {
      var first = !visitedRegions.has(biome.id);
      currentBiome = biome.id;
      visitedRegions.add(biome.id);
      $('region-name').textContent = biome.name;
      $('region-kind').textContent = biome.kind.toUpperCase() + ' · ' +
        String(biome.index + 1).padStart(2, '0');
      $('region-caption').textContent = biome.tagline;
      if (first && visitedRegions.size === PLANET.BIOMES.length) {
        toast('You have set foot in every region on the planet.', 'THE WHOLE WORLD', 5);
      }
    }

    /* the compass, pointing at the nearest wonder still asleep */
    var quarry = null;
    var quarryDistance = Infinity;
    for (var q = 0; q < world.landmarks.length; q++) {
      if (world.landmarks[q].completed) continue;
      var qd = WALK.arcLength(walker.normal, world.landmarks[q].normal, PLANET.RADIUS);
      if (qd < quarryDistance) { quarry = world.landmarks[q]; quarryDistance = qd; }
    }
    if (quarry && view === 'follow') {
      var toward = WALK.tangent(quarry.normal, walker.normal);
      var angle = Math.atan2(toward.dot(cameraRight), toward.dot(cameraUp));
      compassNeedle.style.transform = 'rotate(' + angle + 'rad)';
      $('compass').hidden = false;
      $('compass-distance').textContent = Math.round(quarryDistance) + 'm';
      $('compass-name').textContent = PLANET.BY_ID[quarry.biome].name;
    } else {
      $('compass').hidden = true;
    }
  }

  /* --- lifecycle -------------------------------------------------------------------- */

  document.addEventListener('visibilitychange', function () {
    pageHidden = document.hidden;
    lastFrame = performance.now();
    keys.clear();
    tappedKeys.clear();
    stick.x = stick.y = stickLatch.x = stickLatch.y = 0;
    audio.setPaused(pageHidden);
  });
  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    pageHidden = true;
    $('fallback').hidden = false;
  });
  canvas.addEventListener('webglcontextrestored', function () { location.reload(); });

  function capture() {
    try {
      var url = renderer.domElement.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tiny-world-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Saved to your downloads.', 'PICTURE TAKEN', 2.4);
    } catch (e) {
      toast('This browser would not let us save the picture.', 'PHOTO MODE', 3);
    }
  }

  /* --- the frame ---------------------------------------------------------------------- */

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (pageHidden) return;

    clockTime += dt;
    if (!reducedMotion) animTime += dt;
    var paused = $('journal').open || $('help').open;

    /* Movement is expressed in the camera's own tangent frame, so "forward"
     * always means "away from the camera", whichever way it is facing. */
    camera.updateMatrixWorld();
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
    cameraRight.copy(WALK.tangent(cameraRight, walker.normal));
    cameraUp.copy(WALK.tangent(cameraUp, walker.normal));

    var held = function (k) { return keys.has(k) || tappedKeys.has(k); };
    var stickX = stick.id === null ? stickLatch.x : stick.x;
    var stickY = stick.id === null ? stickLatch.y : stick.y;
    var inputX = paused ? 0 : (held('d') || held('arrowright') ? 1 : 0) - (held('a') || held('arrowleft') ? 1 : 0) + stickX;
    var inputY = paused ? 0 : (held('w') || held('arrowup') ? 1 : 0) - (held('s') || held('arrowdown') ? 1 : 0) + stickY;

    var before = walker.normal.clone();
    var result = { moved: 0, arrived: null };
    if (!paused) {
      result = walker.update(dt, {
        x: inputX, y: inputY, forward: cameraUp, right: cameraRight, running: held('shift'),
      });
    }
    tappedKeys.clear();
    stickLatch.x = stickLatch.y = 0;
    if (Math.hypot(inputX, inputY) > 0.05) {
      waypoint.visible = false;
      $('journey').hidden = true;
    }
    /* Carry the follow-camera's orbit direction along with the explorer. */
    followOrbit.applyQuaternion(new T.Quaternion().setFromUnitVectors(before, walker.normal));

    var speed = dt ? result.moved / dt : 0;
    moving = speed > 0.15;
    document.body.classList.toggle('is-moving', moving);

    /* --- place the explorer ------------------------------------------------ */
    explorer.group.position.copy(walker.normal)
      .multiplyScalar(PLANET.surfaceRadius(walker.normal) + walker.height + (walker.swimming ? -0.27 : 0.022));
    explorer.group.quaternion.copy(walker.quaternion);
    occlusionTarget.value.copy(explorer.group.position).addScaledVector(walker.normal, 0.6);
    occlusionEnabled.value = view === 'follow' ? 1 : 0;
    explorer.update(dt, {
      time: animTime,
      speed: speed,
      swimming: walker.swimming,
      running: walker.running,
      airborne: walker.height > 0.03,
      interacting: clockTime - lastInteract < 0.9,
    });

    companion.update(dt, walker.normal, animTime);

    footShadow.position.copy(walker.normal).multiplyScalar(PLANET.surfaceRadius(walker.normal) + 0.016);
    footShadow.quaternion.setFromUnitVectors(UP, walker.normal);
    footShadow.visible = !walker.swimming;
    footShadow.scale.setScalar(1 + walker.height * 0.17);
    footShadow.material.opacity = 0.21 / (1 + walker.height);
    footRing.position.copy(walker.normal).multiplyScalar(PLANET.surfaceRadius(walker.normal) + 0.04);
    footRing.quaternion.setFromUnitVectors(UP, walker.normal);
    footRing.scale.setScalar(view === 'globe' ? 1.3 + Math.sin(animTime * 3) * 0.09 : 1);
    footRing.material.opacity = view === 'globe' ? 0.75 : 0.25;

    /* --- lighting and sky --------------------------------------------------- */
    var lightState = lighting.update(dt, walker.normal);
    bodies.update(lightState.sunDir, camera);
    var night = 1 - lightState.daylight;
    sky.starMaterial.opacity = 0.08 + night * 0.82;
    sky.starMaterial.size = 0.085 + night * 0.03;
    sky.atmosphere.uniforms.strength.value = 0.03 + lightState.daylight * 0.075;
    sky.atmosphere.uniforms.color.value
      .set('#65bfc0').lerp(new T.Color('#3d5f9e'), night);
    bodies.sunMaterial.uniforms.strength.value = 0.32 + lightState.daylight * 0.62;
    bodies.haloMaterial.uniforms.strength.value = 0.03 + lightState.daylight * 0.13;
    bodies.moonMaterial.uniforms.strength.value = 0.2 + night * 0.68;
    bodies.moonHalo.material.uniforms.strength.value = 0.02 + night * 0.1;
    post.composite.uniforms.nightAmount.value = night;
    post.composite.uniforms.bloomStrength.value = 0.42 + night * 0.5;

    /* The lantern lights itself once it gets dark enough to want one. */
    var lanternOn = night > 0.42;
    explorer.setLanternLit(lanternOn);
    lanternLight.intensity = lanternOn
      ? clamp((night - 0.42) / 0.25, 0, 1) * (4.2 + Math.sin(animTime * 6.5) * 0.35)
      : 0;
    companion.glow.emissiveIntensity = 0.3 + night * 1.6 + Math.sin(animTime * 1.6) * 0.15;

    /* --- camera, HUD, world ticks --------------------------------------------- */
    if (view === 'globe' && !reducedMotion && clockTime - lastInputAt > 14) {
      globeSpin.theta += dt * 0.009;
    }
    updateCamera(dt);
    updateHud();
    checkWisps();

    if (result.arrived) {
      waypoint.visible = false;
      $('journey').hidden = true;
      if (result.arrived !== 'ground') {
        toast(coarsePointer ? 'Tap the golden prompt to see what happens.' : 'Press E to see what happens.',
          'YOU HAVE ARRIVED', 2.8);
      }
    }

    C.tickAll(animTime);
    world.update(animTime);

    for (var c = confetti.length - 1; c >= 0; c--) {
      var bit = confetti[c];
      bit.age += dt;
      bit.velocity.addScaledVector(bit.normal, -dt * 1.8);
      bit.mesh.position.addScaledVector(bit.velocity, dt);
      bit.mesh.rotation.x += dt * 2;
      bit.mesh.rotation.z += dt;
      bit.mesh.scale.setScalar(Math.max(0.01, 1 - bit.age / bit.life));
      if (bit.age >= bit.life) {
        bit.mesh.removeFromParent();
        confetti.splice(c, 1);
      }
    }

    audio.update(dt, {
      speed: paused ? 0 : speed,
      swimming: walker.swimming,
      biome: currentBiome,
      night: night > 0.5,
    });

    if (clockTime > toastUntil) $('toast').classList.remove('visible');

    /* Shadows are re-rendered on a budget rather than every frame. */
    if (clockTime - shadowStamp > (moving ? 0.045 : 0.18) || firstFrame) {
      renderer.shadowMap.needsUpdate = true;
      shadowStamp = clockTime;
    }

    renderer.info.reset();
    post.render();

    if (captureRequested) {
      captureRequested = false;
      capture();
    }

    /* --- adaptive quality ------------------------------------------------------ */
    /* Measured against the wall clock, not the simulation clock: `dt` is capped
     * at 50 ms so the physics stays sane on a stall, and averaging that would
     * report a comfortable 20 fps no matter how slow the machine really is. */
    frames++;
    if (now - frameStamp > 1000) {
      fps = Math.round((frames * 1000) / (now - frameStamp));
      frames = 0;
      frameStamp = now;
      if (clockTime > 4 && downgrades < 2 && fps < 40) {
        downgrades++;
        if (downgrades === 1) {
          maxPixelRatio = Math.min(maxPixelRatio, 1.0);
          resize();
        } else {
          /* Still struggling: drop the bloom chain and the soft shadow filter. */
          post.bloomEnabled = false;
          renderer.shadowMap.type = T.BasicShadowMap;
          lighting.sun.shadow.mapSize.set(1024, 1024);
          lighting.sun.shadow.map = null;
          maxPixelRatio = Math.min(maxPixelRatio, 0.85);
          resize();
        }
      }
    }

    /* --- telemetry (used by the automated smoke test) ---------------------------- */
    if (clockTime - telemetryStamp > 0.25 || firstFrame) {
      telemetryStamp = clockTime;
      var report = {
        ready: true,
        view: view,
        biome: currentBiome,
        normal: walker.normal.toArray().map(function (n) { return Number(n.toFixed(6)); }),
        walked: Number((walker.distance + savedDistance).toFixed(2)),
        height: Number(walker.height.toFixed(3)),
        swimming: walker.swimming,
        moving: moving,
        nearby: nearbyWonder ? nearbyWonder.id : null,
        destination: walker.targetId || (walker.target ? 'ground' : null),
        wonders: Array.from(found),
        wisps: collected.size,
        regions: visitedRegions.size,
        daylight: Number(lightState.daylight.toFixed(3)),
        timeOfDay: Number(lightState.timeOfDay.toFixed(4)),
        phase: lightState.phase,
        fps: fps,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        models: world.stats,
        quality: renderer.getPixelRatio(),
        photo: photoMode,
      };
      $('telemetry').textContent = JSON.stringify(report);
      canvas.dataset.ready = 'true';
      canvas.dataset.biome = currentBiome;
      canvas.dataset.walked = report.walked;
      canvas.dataset.discoveries = found.size;
      canvas.dataset.view = view;
    }

    if (firstFrame) {
      firstFrame = false;
      canvas.classList.add('ready');
      $('loading').classList.add('fade');
      setTimeout(function () { $('loading').hidden = true; }, 800);
    }
  }

  /* Exposed for the automated smoke test and for poking at the world from the
   * console. Nothing in the game reads this back. */
  TW.app = {
    renderer: renderer, scene: scene, camera: camera, post: post, lighting: lighting,
    world: world, walker: walker, explorer: explorer, companion: companion, audio: audio,
    travelTo: travelTo, interact: interact, setView: function (v) { setView(v); },
    goHome: goHome, save: save,
    get view() { return view; },
    get found() { return found; },
    get collected() { return collected; },
  };

  /* --- go ------------------------------------------------------------------------- */

  resize();
  refreshProgress();
  $('region-name').textContent = PLANET.BIOMES[0].name;
  $('region-kind').textContent = PLANET.BIOMES[0].kind.toUpperCase() + ' · 01';
  $('region-caption').textContent = PLANET.BIOMES[0].tagline;
  updateCamera(0);
  updateHud();
  requestAnimationFrame(frame);
})(typeof window !== 'undefined' ? window : this);
