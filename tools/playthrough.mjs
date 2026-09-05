/* =============================================================================
 * playthrough.mjs — the full acceptance run.
 *
 *   node tools/playthrough.mjs
 *   node tools/playthrough.mjs dist/tiny-world.html
 *
 * Visits all eight wonders, activates each, cycles the sky, swims the reef,
 * plans a route across the planet, walks one automatically, enters photo mode,
 * then reloads the page and checks the save came back. Exits non-zero if any
 * of that fails or if the page logs a single error.
 * ============================================================================= */
import { launch, boot, gameUrl, telemetry, report, sleep } from './_browser.mjs';

/* The <output id="telemetry"> block is refreshed on the game's *simulation*
 * clock, which advances at a crawl when frames are slow — fine for a human
 * watching, useless for a test that needs the value as of right now. For
 * anything time-sensitive, read the live objects through TW.app instead. */
const live = (page) => page.evaluate(() => {
  const app = window.TW.app;
  return {
    phase: app.lighting.state.phase,
    daylight: +app.lighting.state.daylight.toFixed(3),
    swimming: app.walker.swimming,
    photo: document.body.classList.contains('photo-mode'),
    found: app.found.size,
    destination: app.walker.targetId || (app.walker.target ? 'ground' : null),
  };
});

const target = process.argv[2] || 'index.html';
const { browser, page, problems } = await launch();
const checks = {};
const fail = (name, why) => problems.push(`${name}: ${why}`);

await boot(page, gameUrl(target));
await page.evaluate(() => localStorage.clear());
await sleep(1200);

/* --- every wonder ---------------------------------------------------------- */
const wonders = await page.evaluate(() =>
  window.TW.app.world.landmarks.map((l) => ({ id: l.id, biome: l.biome })));

for (const w of wonders) {
  await page.evaluate((id) => {
    const app = window.TW.app;
    const lm = app.world.landmarks.find((l) => l.id === id);
    app.walker.normal.copy(lm.normal);
    app.walker.stop();
    app.companion.teleportTo(lm.normal);
    app.setView('follow');
  }, w.id);
  await sleep(900);
  await page.evaluate(() => window.TW.app.interact());
  await sleep(900);
}
const afterWonders = await page.evaluate(() => window.TW.app.found.size);
checks['wonders activated'] = `${afterWonders} / ${wonders.length}`;
if (afterWonders !== wonders.length) fail('wonders', `only ${afterWonders} registered`);

/* --- regions --------------------------------------------------------------- */
const t1 = await telemetry(page);
checks['regions visited'] = `${t1.regions} / 8`;
if (t1.regions !== 8) fail('regions', 'not all regions were entered');

/* --- sky phases ------------------------------------------------------------ */
/* The held sky eases toward its target over several frames, so wait for the
 * value to settle rather than sampling at a fixed delay — on a software
 * rasteriser a "long enough" sleep is a moving target. */
const settled = async () => {
  let last = -1;
  for (let i = 0; i < 60; i++) {
    await sleep(350);
    const t = await live(page);
    /* Ignore the first few polls: the ease needs a handful of frames to even
       start moving, and two identical samples before then are not stability. */
    if (i > 5 && Math.abs(t.daylight - last) < 0.004) return t;
    last = t.daylight;
  }
  return live(page);
};
const skies = {};
for (const _ of ['day', 'dusk', 'night', 'auto']) {
  await page.evaluate(() => document.getElementById('time-button').click());
  const t = await settled();
  skies[t.phase] = t.daylight;
}
checks['sky phases (local daylight)'] = skies;
if (!(skies.day > 0.9) || !(skies.night < 0.1)) fail('sky', 'day/night did not resolve locally');

/* --- swimming -------------------------------------------------------------- */
await page.evaluate(() => {
  const app = window.TW.app;
  const n = window.TW.planet.normalAt('coralhollow', 0, 0);
  app.walker.normal.copy(n);
  app.walker.stop();
});
await sleep(1500);
const swim = await live(page);
checks['swims in the reef'] = swim.swimming;
if (!swim.swimming) fail('swim', 'walker did not enter the water state');

/* --- navigation ------------------------------------------------------------ */
const route = await page.evaluate(() => {
  const TW = window.TW;
  const from = TW.planet.normalAt('mosswood', 0, 0);
  const to = TW.planet.normalAt('frostveil', 0, 0);
  const t0 = performance.now();
  const r = TW.walk.findRoute(from, to, TW.app.world.colliders, TW.planet.RADIUS);
  return { ok: !!r, waypoints: r ? r.length : 0, ms: +(performance.now() - t0).toFixed(1) };
});
checks['cross-planet route'] = `${route.waypoints} waypoints in ${route.ms} ms`;
if (!route.ok) fail('navigation', 'no route found across the planet');

/* --- auto-walk ------------------------------------------------------------- */
await page.evaluate(() => {
  const app = window.TW.app;
  app.walker.normal.copy(window.TW.planet.normalAt('mosswood', 0, 0));
  app.travelTo(window.TW.planet.normalAt('mosswood', 4, 3), null);
});
const arrived = await page.waitForFunction(
  () => !window.TW.app.walker.target,
  { timeout: 180000, polling: 400 }).then(() => true).catch(() => false);
checks['auto-walk arrives'] = arrived;
if (!arrived) fail('auto-walk', 'never reached the destination');

/* --- photo mode ------------------------------------------------------------ */
await page.evaluate(() => document.getElementById('photo-button').click());
await sleep(300);
const photo = (await live(page)).photo;
checks['photo mode'] = photo;
if (!photo) fail('photo', 'did not enter photo mode');
await page.evaluate(() => document.getElementById('photo-button').click());

/* --- persistence ----------------------------------------------------------- */
await page.reload({ waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(
  () => document.getElementById('world') && document.getElementById('world').dataset.ready === 'true',
  { timeout: 240000, polling: 500 });
await sleep(1500);
const restored = await live(page);
const tel = await telemetry(page);
checks['save survives reload'] = `${restored.found} wonders`;
checks['spawns in daylight'] = restored.daylight;
checks['telemetry channel'] = tel.ready === true ? 'reporting' : 'MISSING';
if (restored.found !== wonders.length) fail('persistence', 'save did not restore');
if (restored.daylight < 0.5) fail('lighting', 'spawn is not in daylight');
if (tel.ready !== true) fail('telemetry', 'no telemetry published');

const ok = report('PLAYTHROUGH — ' + target, checks, problems);
await browser.close();
process.exit(ok ? 0 : 1);
