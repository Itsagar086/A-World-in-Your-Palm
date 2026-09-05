/* =============================================================================
 * make-pdf.mjs — render docs/report.html to a print-ready PDF.
 *
 *   node tools/make-pdf.mjs
 *
 * Lives in tools/ because that is where puppeteer-core is installed; it writes
 * its output into docs/. Uses whichever Chrome or Edge is already on the machine.
 * ============================================================================= */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { findBrowser, ROOT } from './_browser.mjs';

const SOURCE = path.join(ROOT, 'docs', 'report.html');
const TARGET = path.join(ROOT, 'docs', 'A-World-in-Your-Palm-Report.pdf');

if (!fs.existsSync(SOURCE)) {
  console.error('missing ' + SOURCE);
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: 'new',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page]', e.message));

await page.goto('file:///' + SOURCE.split(String.fromCharCode(92)).join('/'), { waitUntil: 'networkidle0', timeout: 60000 });
await page.emulateMediaType('print');

const footer = `
  <div style="width:100%;font-family:Georgia,serif;font-size:7.5pt;color:#8fa3a0;
              padding:2mm 16mm 0;display:flex;justify-content:space-between;
              border-top:0.4pt solid #d8ded6;margin:0 0 4mm;">
    <span>A World in Your Palm &middot; Project Report</span>
    <span class="pageNumber"></span>
  </div>`;

await page.pdf({
  path: TARGET,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: footer,
  preferCSSPageSize: true,   /* @page in report.html owns the margins */
});

await browser.close();
const kb = (fs.statSync(TARGET).size / 1024).toFixed(0);
console.log(`PDF written: docs/A-World-in-Your-Palm-Report.pdf (${kb} KB)`);
