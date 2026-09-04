/* =============================================================================
 * A World in Your Palm — build.mjs
 *
 * Inlines the Three.js runtime and every source file into one self-contained
 * HTML document. The result opens straight from the file system with no
 * server, no network and no build tooling — double-click and you are on the
 * planet. Run with:  node build.mjs
 * ============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const readFile = (p) => fs.readFileSync(path.join(root, p), 'utf8');

/** A closing script tag inside a string literal would end the block early. */
const escapeForInline = (js) => js.replace(/<\/script>/gi, '<\\/script>');

const html = readFile('index.html');

/* Pull the script tags out of index.html in document order so the build can
 * never drift from what the dev page actually loads. */
const tagPattern = /[ \t]*<script src="([^"]+)"><\/script>\r?\n?/g;
const sources = [];
let match;
while ((match = tagPattern.exec(html)) !== null) sources.push(match[1]);

if (!sources.length) {
  console.error('build: found no <script src> tags in index.html');
  process.exit(1);
}

let bytes = 0;
const inlined = sources
  .map((src) => {
    const code = readFile(src);
    bytes += code.length;
    return `<script>/* ${src} */\n${escapeForInline(code)}\n</script>`;
  })
  .join('\n');

/* Replace the whole run of script tags with the inlined bundle. */
const first = html.indexOf('<script src=');
const lastTag = html.lastIndexOf('</script>') + '</script>'.length;
const out = html.slice(0, first) + inlined + html.slice(lastTag);

const target = path.join(root, 'dist', 'tiny-world.html');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, out, 'utf8');

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`build: ${sources.length} sources (${kb(bytes)}) -> dist/tiny-world.html (${kb(out.length)})`);
for (const src of sources) console.log('  · ' + src);
