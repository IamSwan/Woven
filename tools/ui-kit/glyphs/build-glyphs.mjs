// build-glyphs.mjs: collects the unique SVG glyphs of tools/ui-kit/target.html and rasterizes them into one white-on-transparent PNG sprite sheet.
// Run: node tools/ui-kit/glyphs/build-glyphs.mjs   (needs Edge or Chrome installed; no npm packages)
// Writes woven-glyphs.png, woven-glyphs.luau and preview.html next to this file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodePng, encodePng } from '../png.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CELL = 64, PAD = 4, COLS = 8; // 8 * 64 = 512 wide (power of two)

// name -> distinctive piece of the path data (first match wins), in sheet order.
// aliases: other names the kit gives the very same shape (same Rects entry, see Aliases in the .luau).
const GLYPHS = [
  ['health', 'M12 20s-7-4.4'],
  ['mana', 'M12 3l5 9-5 9-5-9z'],
  ['stamina', 'M5 7l5 5-5 5'],
  ['protected', 'M9 12l2 2 4-4'], // before posture: both are the shield, this one has the tick
  ['posture', 'M12 3l7 3v5c0'],
  ['burnout', 'M12 3c.6 3.5 5 5.5', { aliases: ['burning'] }],
  ['fire', 'M12 2.8c.6 3.6'],
  ['water', 'M12 3c3.2 4.6'],
  ['earth', 'M2.8 19.5 9 8.5'],
  ['air', 'M3 8.5c2.2-1.8'],
  ['spirit', 'M12.6 12.2a1.2'],
  ['bond', 'M10 14a4 4 0 0 0 5.7', { aliases: ['catControl'] }], // the Book's Control category chip uses the same chain
  ['lock', 'rect x="6" y="11"', { aliases: ['stilled', 'suppressed'] }],
  ['silenced', 'M4 9h3l5-4v14'],
  ['pvp', 'M4 4l9 9'],
  ['brokenLeg', 'M7 17l10-10'],
  ['tied', 'M7 4h10a2 2 0 0 1 2 2v12', { aliases: ['weaveBook'] }],
  ['sword', 'M14.5 4H20v5.5', { aliases: ['guardian'] }],
  ['headshot', 'circle cx="9" cy="8" r="3"', { aliases: ['social'] }],
  ['moon', 'M20 14.5A8 8'],
  ['star', 'M12 3l2.6 5.6'],
  ['channel', 'M13 3L5 13h6'],
  ['sprint', 'circle cx="14" cy="4.5"'],
  ['robux', 'M12 3l7.8 4.5'],
  ['check', 'M5 12l5 5 9-10'],
  ['confirm', 'M5 12.5l4.5 4.5L19 7.5'],
  ['close', 'M6 6l12 12'],
  ['plus', 'M12 5v14M5 12h14'],
  ['arrow', 'M5 12h14'],
  ['spinner', 'circle cx="12" cy="12" r="8.5"'],
  ['form1', 'M4 18L12 6l8 12'],
  ['form2', 'M4 12c4-6 12-6 16 0'],
  ['form3', 'M5 5l14 14'],
  ['form4', 'M4 8h16'],
  ['form5', 'M6 4v16'],
  // Book weave-category chips (#t-book). Appended so every glyph above keeps its cell: the uploaded sheet's rects stay valid.
  ['catAll', 'rect x="4" y="4" width="6.5"'],
  ['catCombat', 'M5 19 18.5 5.5'],
  ['catDefensive', 'M12 3 4.5 6v6'],
  ['catElemental', 'M12 3 20.5 9.2'],
  ['catUtility', 'M12 21V9'],
  ['catAdvanced', 'M12 3l2.4 6.1'],
  ['catCircle', 'circle cx="12" cy="4.5" r="1.6"'],
];

// 1. collect unique glyphs (dedupe by inner markup) from target.html
const html = fs.readFileSync(path.join(here, '..', 'target.html'), 'utf8');
const byInner = new Map();
for (const m of html.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)) {
  if (!/viewBox="0 0 24 24"/.test(m[1])) continue;
  const attr = (n) => (m[1].match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1];
  const g = byInner.get(m[2]) || { inner: m[2], widths: {}, cap: attr('stroke-linecap'), join: attr('stroke-linejoin') };
  const w = attr('stroke-width') || '1';
  g.widths[w] = (g.widths[w] || 0) + 1;
  byInner.set(m[2], g);
}
const found = [...byInner.values()];
const used = new Set();
const glyphs = GLYPHS.map(([name, needle, opt = {}]) => {
  const g = found.find((f) => !used.has(f) && f.inner.includes(needle));
  if (!g) throw new Error(`glyph ${name}: nothing in target.html matches ${needle}`);
  used.add(g);
  const sw = Object.entries(g.widths).sort((a, b) => b[1] - a[1])[0][0]; // most used stroke width
  return { name, aliases: opt.aliases || [], inner: g.inner, sw, cap: g.cap || 'butt', join: g.join || 'miter' };
});
const missed = found.filter((f) => !used.has(f));
if (missed.length) throw new Error('unnamed glyphs in target.html:\n' + missed.map((f) => f.inner).join('\n'));

// 2. sheet layout
const cols = COLS, rows = Math.ceil(glyphs.length / cols), W = cols * CELL, H = rows * CELL;
if (W > 1024 || H > 1024) throw new Error(`sheet ${W}x${H} too big`);
glyphs.forEach((g, i) => { g.x = (i % cols) * CELL; g.y = Math.floor(i / cols) * CELL; });

// 3. rasterize with headless Edge/Chrome (transparent background, white strokes)
const svgOf = (g, color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${g.sw}" stroke-linecap="${g.cap}" stroke-linejoin="${g.join}">${g.inner}</svg>`;
const sheetHtml = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{position:absolute;width:${CELL - PAD * 2}px;height:${CELL - PAD * 2}px;overflow:visible}</style><body>` +
  glyphs.map((g) => svgOf(g, '#ffffff').replace('<svg ', `<svg style="left:${g.x + PAD}px;top:${g.y + PAD}px" `)).join('') + '</body>';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'woven-glyphs-'));
const htmlPath = path.join(tmp, 'sheet.html'), shot = path.join(tmp, 'sheet.png');
fs.writeFileSync(htmlPath, sheetHtml);
const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter((p) => fs.existsSync(p));
if (!browsers.length) throw new Error('no Edge or Chrome found');
let ok = false;
for (const exe of browsers) {
  for (const headless of ['--headless=old', '--headless=new']) {
    fs.rmSync(shot, { force: true });
    spawnSync(exe, [headless, '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--default-background-color=00000000',
      `--user-data-dir=${path.join(tmp, 'profile')}`, `--window-size=${W},${H}`, `--screenshot=${shot}`, pathToFileURL(htmlPath).href], { timeout: 60000 });
    const img = fs.existsSync(shot) && decodePng(fs.readFileSync(shot));
    if (img && img.w === W && img.h === H) { ok = true; break; }
  }
  if (ok) break;
}
if (!ok) throw new Error('screenshot failed or has the wrong size');

// 4. force pure white: keep alpha, set rgb to 255 (kills any browser tint on semi-transparent edges)
const img = decodePng(fs.readFileSync(shot));
for (let i = 0; i < img.rgba.length; i += 4) { img.rgba[i] = img.rgba[i + 1] = img.rgba[i + 2] = 255; }
const pngPath = path.join(here, 'woven-glyphs.png'), luauPath = path.join(here, 'woven-glyphs.luau');
const newPng = encodePng(W, H, img.rgba);
const oldPng = fs.existsSync(pngPath) ? fs.readFileSync(pngPath) : null;
const oldSheetLine = fs.existsSync(luauPath) ? (fs.readFileSync(luauPath, 'utf8').match(/^\tSheetId = .*$/m) || [])[0] : null; // hand-set after upload, kept across builds
if (oldPng && !oldPng.equals(newPng)) console.warn('WARNING: the PNG changed since the last build: re-upload woven-glyphs.png and update SheetId (the kept id is stale).');
fs.writeFileSync(pngPath, newPng);
fs.rmSync(tmp, { recursive: true, force: true });

// dark composite (#141517) for eyeballing; not for upload
const dark = Buffer.alloc(img.rgba.length);
for (let i = 0; i < dark.length; i += 4) {
  const a = img.rgba[i + 3] / 255;
  dark[i] = Math.round(0x14 + (255 - 0x14) * a); dark[i + 1] = Math.round(0x15 + (255 - 0x15) * a); dark[i + 2] = Math.round(0x17 + (255 - 0x17) * a); dark[i + 3] = 255;
}
fs.writeFileSync(path.join(here, 'preview-dark.png'), encodePng(W, H, dark));

// 5. Luau map
const luau = `-- WovenGlyphs: rects of each glyph in the uploaded glyph sheet.
-- Generated by tools/ui-kit/glyphs/build-glyphs.mjs; do not edit by hand. Cells are ${CELL}x${CELL}, white on transparent: tint with ImageColor3.
-- Use: ImageRectOffset = WovenGlyphs.Rects[name], ImageRectSize = Vector2.new(WovenGlyphs.Cell, WovenGlyphs.Cell)
return {
${oldSheetLine ?? '\tSheetId = 0, -- set to the uploaded image id (rbxassetid://...) once the owner uploads woven-glyphs.png'}
\tCell = ${CELL},
\tSize = Vector2.new(${W}, ${H}),
\tRects = {
${glyphs.map((g) => `\t\t${g.name} = Vector2.new(${g.x}, ${g.y}),`).join('\n')}
\t},
\t-- other names the kit uses for the same shape
\tAliases = {
${glyphs.flatMap((g) => g.aliases.map((a) => `\t\t${a} = "${g.name}",`)).join('\n')}
\t},
}
`;
fs.writeFileSync(luauPath, luau);

// 6. preview page
const cell = (g, bg, fg) => `<div class="c"><div class="g" style="background-position:-${g.x}px -${g.y}px;${fg}"></div><span>${g.name}${g.aliases.length ? '<br><i>' + g.aliases.join(', ') + '</i>' : ''}</span></div>`;
const preview = `<!doctype html><meta charset="utf-8"><title>Woven glyphs</title><style>
body{margin:0;font:12px system-ui,sans-serif}
section{padding:16px;display:flex;flex-wrap:wrap;gap:10px}
.dark{background:#0e0f12;color:#f4ecdc}.light{background:#e8d9b5;color:#2e1e10}
.c{width:84px;text-align:center}.c span{display:block;margin-top:2px}.c i{opacity:.65;font-style:normal}
.g{width:${CELL}px;height:${CELL}px;margin:0 auto;background:url(woven-glyphs.png) no-repeat;border:1px dashed rgba(128,128,128,.35);box-sizing:content-box}
.light .g{filter:invert(1)}
h2{margin:0;padding:12px 16px 0;font-size:14px}
</style><body>
<div class="dark"><h2>Dark (white as stored)</h2><section>${glyphs.map((g) => cell(g)).join('')}</section></div>
<div class="light"><h2>Light (inverted to show the shapes)</h2><section>${glyphs.map((g) => cell(g)).join('')}</section></div>
</body>`;
fs.writeFileSync(path.join(here, 'preview.html'), preview);

console.log(`woven-glyphs.png ${W}x${H}, ${glyphs.length} glyphs`);
console.log(glyphs.map((g) => g.name + (g.aliases.length ? `(=${g.aliases.join('=')})` : '')).join(' '));
