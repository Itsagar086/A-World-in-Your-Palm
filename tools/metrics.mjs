/* =============================================================================
 * metrics.mjs — what the world actually costs.
 *
 *   node tools/metrics.mjs
 *
 * Prints the build-time and runtime numbers quoted in the project report:
 * how many meshes were authored, how many survived baking, what reaches the
 * GPU, and how long a cross-planet route takes to plan.
 * ============================================================================= */
import { launch, boot, gameUrl, telemetry, sleep } from './_browser.mjs';

const { browser, page, problems } = await launch();
const bootMs = await boot(page);
await sleep(1500);

const m = await page.evaluate(() => {
  const TW = window.TW;
  const app = TW.app;
  let meshes = 0, instanced = 0, transparent = 0, emissive = 0, groups = 0, tris = 0;
  app.scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      if (o.isInstancedMesh) instanced++;
      const mt = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mt && mt.transparent) transparent++;
      if (mt && mt.emissive && mt.emissive.getHex()) emissive++;
      const g = o.geometry;
      tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.count || 1);
    } else if (o.isGroup) groups++;
  });

  const t0 = performance.now();
  const route = TW.walk.findRoute(
    TW.planet.normalAt('mosswood', 0, 0),
    TW.planet.normalAt('frostveil', 0, 0),
    app.world.colliders, TW.planet.RADIUS);
  const routeMs = +(performance.now() - t0).toFixed(1);

  const t = JSON.parse(document.getElementById('telemetry').textContent);
  return {
    authoredMeshes: TW.core.bake.totalMerged,
    mergedBatches: TW.core.bake.totalBatches,
    prunedGroups: app.world.ctx.root.userData.pruned,
    sceneMeshes: meshes, instancedMeshes: instanced,
    transparentMeshes: transparent, emissiveMeshes: emissive, sceneGroups: groups,
    sceneTriangles: Math.round(tris), worldTriangles: app.world.stats.triangles,
    terrainVertices: app.world.terrain.geometry.attributes.position.count,
    seaVertices: app.world.sea.geometry.attributes.position.count,
    colliders: app.world.stats.colliders,
    wonders: app.world.stats.landmarks, wisps: app.world.stats.wisps,
    animationTickers: TW.core.tickers.length,
    routeWaypoints: route ? route.length : 0, routePlanMs: routeMs,
    drawCalls: t.drawCalls, pixelRatio: t.quality,
  };
});

const pct = (a, b) => ((a / b) * 100).toFixed(1) + '%';
const rows = [
  ['Boot to first frame', bootMs + ' ms  (software rasteriser)'],
  ['', ''],
  ['Meshes authored in code', m.authoredMeshes.toLocaleString('en-US')],
  ['Merged into batches', m.mergedBatches + '   (' + pct(m.mergedBatches, m.authoredMeshes) + ' of the original count)'],
  ['Empty groups pruned', m.prunedGroups.toLocaleString('en-US')],
  ['', ''],
  ['Meshes reaching the GPU', m.sceneMeshes + '   (' + m.instancedMeshes + ' instanced)'],
  ['  · transparent', m.transparentMeshes],
  ['  · emissive', m.emissiveMeshes],
  ['Groups in the scene graph', m.sceneGroups],
  ['Draw calls this frame', m.drawCalls + '   (includes the shadow pass)'],
  ['', ''],
  ['Triangles — whole scene', m.sceneTriangles.toLocaleString('en-US')],
  ['Triangles — planet only', m.worldTriangles.toLocaleString('en-US')],
  ['Terrain vertices', m.terrainVertices.toLocaleString('en-US')],
  ['Sea vertices', m.seaVertices.toLocaleString('en-US')],
  ['', ''],
  ['Collision caps', m.colliders],
  ['Wonders / wisps', m.wonders + ' / ' + m.wisps],
  ['Per-frame animation callbacks', m.animationTickers],
  ['', ''],
  ['Route across the planet', m.routeWaypoints + ' waypoints in ' + m.routePlanMs + ' ms'],
];

console.log('\nA WORLD IN YOUR PALM — measured');
console.log('═'.repeat(64));
for (const [k, v] of rows) console.log(k ? '  ' + k.padEnd(30) + v : '');
console.log('\n  problems: ' + (problems.length ? problems.join('; ') : 'none') + '\n');

await browser.close();
process.exit(problems.length ? 1 : 0);
