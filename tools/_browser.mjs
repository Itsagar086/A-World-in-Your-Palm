/* =============================================================================
 * Shared browser plumbing for the verification scripts.
 *
 * These drive a real Chrome in headless mode against the real game — no mocks,
 * no stubs. Rendering falls back to SwiftShader (software rasterisation) when
 * no GPU is available to the headless process, which is fine for correctness
 * but says nothing useful about frame rate. Read the game's own `fps` field
 * only on a machine with a real GPU.
 * ============================================================================= */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Chrome is not bundled — puppeteer-core drives whatever is already installed. */
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function findBrowser() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('No Chrome or Edge found. Set CHROME_PATH to your browser executable.');
}

/** file:// URL for a project file, so the harness needs no web server. */
export function gameUrl(file = 'index.html', query = '?qa') {
  return 'file:///' + path.join(ROOT, file).replace(/\\/g, '/') + query;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch(viewport = { width: 1280, height: 800 }) {
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: 'new',
    args: [
      '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
      '--no-sandbox', '--disable-gpu-sandbox',
    ],
    defaultViewport: viewport,
    protocolTimeout: 600000,
  });
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => problems.push('blocked: ' + r.url().split('/').pop()));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push('console: ' + m.text());
  });
  return { browser, page, problems };
}

/** Load the game and wait for the first rendered frame. */
export async function boot(page, url = gameUrl()) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(
    () => document.getElementById('world') && document.getElementById('world').dataset.ready === 'true',
    { timeout: 240000, polling: 500 }
  );
  return Date.now() - t0;
}

/** The game publishes its whole runtime state as JSON for exactly this purpose. */
export const telemetry = (page) =>
  page.evaluate(() => JSON.parse(document.getElementById('telemetry').textContent));

export function report(title, rows, problems) {
  const width = Math.max(...Object.keys(rows).map((k) => k.length));
  console.log('\n' + title);
  console.log('─'.repeat(title.length));
  for (const [k, v] of Object.entries(rows)) {
    console.log('  ' + k.padEnd(width) + '  ' + (typeof v === 'object' ? JSON.stringify(v) : v));
  }
  console.log('\n  problems: ' + (problems.length ? '\n    ' + problems.join('\n    ') : 'none'));
  return problems.length === 0;
}
