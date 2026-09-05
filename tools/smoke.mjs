/* =============================================================================
 * smoke.mjs — does the game load and render at all?
 *
 *   node tools/smoke.mjs                    # checks index.html
 *   node tools/smoke.mjs dist/tiny-world.html
 *
 * Exits non-zero on any page error, blocked request or missing first frame,
 * so it can be dropped straight into CI.
 * ============================================================================= */
import { launch, boot, gameUrl, telemetry, report, sleep } from './_browser.mjs';

const target = process.argv[2] || 'index.html';
const { browser, page, problems } = await launch();

let bootMs = 0;
try {
  bootMs = await boot(page, gameUrl(target));
} catch (e) {
  problems.push('never reached first frame: ' + e.message);
}
await sleep(1200);

const t = problems.length ? {} : await telemetry(page);
const world = problems.length ? {} : await page.evaluate(() => ({
  regions: window.TW.planet.BIOMES.map((b) => b.name),
  modules: Object.keys(window.TW),
}));

const ok = report('SMOKE — ' + target, {
  'first frame': bootMs + ' ms',
  'modules loaded': (world.modules || []).length,
  'regions': (world.regions || []).join(', '),
  'starting region': t.biome,
  'wonders / wisps': `${(t.models || {}).landmarks} / ${(t.models || {}).wisps}`,
  'world triangles': (t.models || {}).triangles,
  'draw calls': t.drawCalls,
  'daylight at spawn': t.daylight,
}, problems);

await browser.close();
process.exit(ok ? 0 : 1);
