// build.mjs: builds docs/ui-kit/index.html from docs/ui-kit/data/ui.json (the Studio export).
// Downloads missing images through the public thumbnails API, pre-tints images that use ImageColor3, embeds the
// Roblox fonts found in the local Studio install, derives design tokens and inlines renderer.js and page.js.
// Usage: node tools/ui-kit/build.mjs   (Node 22+, no dependencies)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT, readUiMap } from './docs.mjs';

const KIT_DIR = path.join(ROOT, 'docs', 'ui-kit');
const ASSETS = path.join(KIT_DIR, 'assets');
const TOOLS = path.join(ROOT, 'tools', 'ui-kit');
const UA = { 'User-Agent': 'woven-ui-kit/1.0 (local docs build)' };
const THUMB_SIZE = '700x700'; // largest square size the assets thumbnail endpoint accepts
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const idOf = (img) => ((img || '').match(/(\d{5,})/) || [])[1];
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

const ui = JSON.parse(fs.readFileSync(path.join(KIT_DIR, 'data', 'ui.json'), 'utf8'));
const uiMap = readUiMap();
fs.mkdirSync(path.join(ASSETS, 'tint'), { recursive: true });

// ---------- walk the export ----------
const all = []; // {node, path, gui, parent}
function walk(n, p, gui, parent) {
  const full = p ? p + '.' + n.name : n.path;
  all.push({ node: n, path: full, gui, parent });
  for (const c of n.children || []) walk(c, full, gui, n);
}
for (const g of ui.guis) walk(g, '', g, null);
const guiObjects = all.filter((e) => e.node.props && e.node.props.Size);
const modOf = (n, cls) => (n.children || []).find((c) => c.class === cls && c.props?.Enabled !== false);

// ---------- code tokens (ButtonTemplateView, TopButtonTheme) ----------
const code = ui.codeModules || {};
const bt = code.ButtonTemplateView?.source || '';
const tb = code.TopButtonTheme?.source || '';
const rgb = (s) => { const m = s && s.match(/fromRGB\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/); return m ? '#' + m.slice(1).map((v) => (+v).toString(16).padStart(2, '0')).join('') : null; };
const tok = {
  font: (bt.match(/M\.Font = Font\.fromEnum\(Enum\.Font\.(\w+)\)/) || [])[1],
  ink: rgb((bt.match(/M\.Color = (Color3\.fromRGB\([^)]*\))/) || [])[1]),
  red: rgb((bt.match(/RED = M\.Color, (Color3\.fromRGB\([^)]*\))/) || [])[1]),
  strip: (bt.match(/STRIP, STRIP_ACTIVE = "rbxassetid:\/\/(\d+)"/) || [])[1],
  stripActive: (bt.match(/STRIP, STRIP_ACTIVE = "rbxassetid:\/\/\d+", "rbxassetid:\/\/(\d+)"/) || [])[1],
  slice: ((bt.match(/STRIP_SLICE = Rect\.new\(([^)]*)\)/) || [])[1] || '').split(',').map(Number).filter((v) => !isNaN(v)),
  sliceScale: Number((bt.match(/strip\.SliceScale = ([\d.]+)/) || [])[1]),
  hover: rgb((bt.match(/MouseEnter:Connect\(function\(\)strip\.ImageColor3 = (Color3\.fromRGB\([^)]*\))/) || [])[1]),
  textBox: rgb((bt.match(/d\.BackgroundColor3 = (Color3\.fromRGB\([^)]*\))/) || [])[1]),
  topColor: rgb((tb.match(/Color = (Color3\.fromRGB\([^)]*\))/) || [])[1]),
  topTransparency: Number((tb.match(/Transparency = ([\d.]+)/) || [])[1]),
  topSize: Number((tb.match(/Size = (\d+)/) || [])[1]),
  topSpacing: Number((tb.match(/Spacing = (\d+)/) || [])[1]),
};
const tokOk = { button: !!(tok.font && tok.ink && tok.strip && tok.slice.length === 4), top: !!(tok.topColor && tok.topSize) };
const ENUM_FONT = { Fondamento: 'Fondamento', SourceSansBold: 'SourceSansPro' };
const codeFont = (e, weight = 'Regular') => ({ family: `rbxasset://fonts/families/${ENUM_FONT[e] || e}.json`, weight, style: 'Normal' });

// ---------- images ----------
const imgUse = {}; // id -> {count, paths, scaleTypes, slices, rects, maxX, maxY}
function useImage(id, p, pth) {
  const u = (imgUse[id] ??= { count: 0, paths: [], scaleTypes: {}, slices: new Set(), rects: 0, needX: 0, needY: 0, code: false });
  u.count++;
  if (u.paths.length < 4) u.paths.push(pth);
  const st = p.ScaleType || 'Stretch';
  u.scaleTypes[st] = (u.scaleTypes[st] || 0) + 1;
  if (st === 'Slice' && p.SliceCenter) {
    u.slices.add(`${p.SliceCenter.join(',')} @${+(p.SliceScale ?? 1).toFixed(2)}`);
    u.needX = Math.max(u.needX, p.SliceCenter[2]); u.needY = Math.max(u.needY, p.SliceCenter[3]);
  }
  const rs = p.ImageRectSize || [0, 0], ro = p.ImageRectOffset || [0, 0];
  if (rs[0] > 0 && rs[1] > 0) { u.rects++; u.needX = Math.max(u.needX, ro[0] + rs[0]); u.needY = Math.max(u.needY, ro[1] + rs[1]); }
}
for (const e of guiObjects) { const id = idOf(e.node.props.Image); if (id) useImage(id, e.node.props, e.path); }
for (const [name, m] of Object.entries(code)) {
  for (const x of m.source.matchAll(/rbxassetid:\/\/(\d+)/g)) {
    const u = (imgUse[x[1]] ??= { count: 0, paths: [], scaleTypes: {}, slices: new Set(), rects: 0, needX: 0, needY: 0, code: false });
    u.code = true;
    if (u.paths.length < 4) u.paths.push(m.path + ' (code)');
  }
}
if (tokOk.button) for (const id of [tok.strip, tok.stripActive]) {
  imgUse[id].slices.add(`${tok.slice.join(',')} @${tok.sliceScale} (code)`);
  imgUse[id].needX = Math.max(imgUse[id].needX, tok.slice[2]); imgUse[id].needY = Math.max(imgUse[id].needY, tok.slice[3]);
}
const ids = Object.keys(imgUse);

const manifestFile = path.join(ASSETS, 'images.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
const pngDims = (buf) => (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null);

async function fetchThumbs(list) {
  const res = {};
  let pending = list;
  for (let attempt = 0; attempt < 10 && pending.length; attempt++) {
    if (attempt) await sleep(2500);
    const next = [];
    for (let i = 0; i < pending.length; i += 50) {
      const batch = pending.slice(i, i + 50);
      const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${batch.join(',')}&returnPolicy=PlaceHolder&size=${THUMB_SIZE}&format=Png&isCircular=false`;
      let r;
      try { r = await fetch(url, { headers: UA }); } catch (e) { next.push(...batch); continue; }
      if (r.status === 429 || r.status >= 500) { next.push(...batch); continue; }
      if (!r.ok) { for (const id of batch) res[id] = { error: 'HTTP ' + r.status }; continue; }
      const j = await r.json();
      const seen = new Set();
      for (const d of j.data || []) {
        const id = String(d.targetId);
        seen.add(id);
        if (d.state === 'Completed' && d.imageUrl) res[id] = { url: d.imageUrl };
        else if (d.state === 'Pending') next.push(id);
        else res[id] = { error: d.state || 'no state' };
      }
      for (const id of batch) if (!seen.has(id)) res[id] = { error: 'not returned' };
    }
    pending = next;
  }
  for (const id of pending) res[id] = { error: 'still Pending after retries' };
  return res;
}

const missing = ids.filter((id) => !(manifest[id]?.file && fs.existsSync(path.join(KIT_DIR, manifest[id].file))));
let downloaded = 0;
if (missing.length) {
  const thumbs = await fetchThumbs(missing);
  const queue = Object.entries(thumbs);
  async function worker() {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const [id, t] = item;
      if (t.error) { manifest[id] = { error: t.error }; continue; }
      try {
        const r = await fetch(t.url, { headers: UA });
        const buf = Buffer.from(await r.arrayBuffer());
        const dims = r.ok && pngDims(buf);
        if (!dims) { manifest[id] = { error: `bad image (HTTP ${r.status})` }; continue; }
        fs.writeFileSync(path.join(ASSETS, id + '.png'), buf);
        manifest[id] = { file: `assets/${id}.png`, w: dims[0], h: dims[1], source: 'thumbnails.roblox.com ' + THUMB_SIZE };
        downloaded++;
      } catch (e) { manifest[id] = { error: String(e.message || e) }; }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
}
const failed = ids.filter((id) => !manifest[id]?.file);

// Native size: exact from Studio (EditableImage) when it could load the asset, else estimated from the
// thumbnail aspect: the smallest common upload size whose pixels contain every slice/rect coordinate used.
const kitImages = {};
let exactCrops = 0, approxCrops = 0;
for (const id of ids) {
  const m = manifest[id];
  if (!m?.file) continue;
  const s = ui.imageSizes?.[id];
  const u = imgUse[id];
  let nw = m.w, nh = m.h, exact = false, how = 'thumbnail size';
  if (Array.isArray(s)) { [nw, nh] = s; exact = true; how = 'Studio (exact)'; }
  else if (u.needX || u.needY) {
    const aspect = m.w / m.h;
    for (const long of [128, 256, 512, 1024]) {
      const w = aspect >= 1 ? long : Math.round(long * aspect), h = aspect >= 1 ? Math.round(long / aspect) : long;
      nw = w; nh = h;
      if (w >= u.needX && h >= u.needY) break;
    }
    how = 'estimated from aspect';
  }
  if (u.slices.size || u.rects) { if (exact) exactCrops++; else approxCrops++; }
  kitImages[id] = { file: m.file, w: m.w, h: m.h, nw, nh, exact, how };
}

// ---------- PNG decode/encode (8-bit, non-interlaced) for tinting ----------
function decodePng(buf) {
  if (!pngDims(buf)) return null;
  let off = 8, w, h, depth, ctype, interlace, pal = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'PLTE') pal = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (depth !== 8 || interlace || !ch) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(w * h * 4), line = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      if (ctype === 6) line.copy(out, o, s, s + 4);
      else if (ctype === 2) { out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = 255; }
      else if (ctype === 0) { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = 255; }
      else if (ctype === 4) { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = line[s + 1]; }
      else { const i = line[s]; out[o] = pal[i * 3]; out[o + 1] = pal[i * 3 + 1]; out[o + 2] = pal[i * 3 + 2]; out[o + 3] = trns && i < trns.length ? trns[i] : 255; }
    }
    line.copy(prev);
  }
  return { w, h, rgba: out };
}
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
{ // self-check: a 2x1 image survives encode/decode.
  const px = Buffer.from([255, 0, 0, 255, 0, 128, 255, 64]);
  const back = decodePng(encodePng(2, 1, px));
  if (!back || !back.rgba.equals(px)) throw new Error('PNG codec self-check failed');
}
const tints = {};
let tintFailed = 0;
const tintKeys = new Set(guiObjects.filter((e) => idOf(e.node.props.Image) && e.node.props.ImageColor3 && e.node.props.ImageColor3 !== '#ffffff').map((e) => idOf(e.node.props.Image) + '_' + e.node.props.ImageColor3.slice(1)));
for (const key of tintKeys) {
  const [id, hex] = key.split('_');
  const out = path.join(ASSETS, 'tint', key + '.png');
  if (!kitImages[id]) { tintFailed++; continue; }
  if (!fs.existsSync(out)) {
    const img = decodePng(fs.readFileSync(path.join(KIT_DIR, kitImages[id].file)));
    if (!img) { tintFailed++; continue; }
    const t = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 0; i < img.rgba.length; i += 4) for (let c = 0; c < 3; c++) img.rgba[i + c] = Math.round((img.rgba[i + c] * t[c]) / 255);
    fs.writeFileSync(out, encodePng(img.w, img.h, img.rgba));
  }
  tints[key] = `assets/tint/${key}.png`;
}

// ---------- fonts ----------
const WEIGHT = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Heavy: 900 };
const WEB_FALLBACK = { Fondamento: ['Fondamento', 'serif'], Merriweather: ['Merriweather', 'serif'], Kalam: ['Kalam', 'cursive'], SourceSansPro: ['Source Sans 3', 'sans-serif'], BuilderSans: ['Figtree', 'sans-serif'], LegacyArial: ['Arial', 'sans-serif'], Guru: [null, 'sans-serif'] };
const usedFaces = {}; // family uri -> Set of "weight|style"
const addFace = (f) => { if (f?.family) (usedFaces[f.family] ??= new Set()).add(`${WEIGHT[f.weight] || 400}|${f.style === 'Italic' ? 'italic' : 'normal'}`); };
for (const e of guiObjects) addFace(e.node.props.FontFace);
if (tokOk.button) { addFace(codeFont(tok.font)); addFace(codeFont('SourceSansBold', 'Bold')); }

function studioFontsDir() {
  if (process.env.ROBLOX_FONTS_DIR) return process.env.ROBLOX_FONTS_DIR;
  const base = path.join(process.env.LOCALAPPDATA || '', 'Roblox', 'Versions');
  if (!fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).map((d) => path.join(base, d, 'content', 'fonts')).filter((d) => fs.existsSync(path.join(d, 'families')));
  dirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0] || null;
}
const fontsDir = studioFontsDir();
const fontCss = [];
const kitFonts = {};
const googleFamilies = new Set();
const fontReport = [];
for (const [uri, faces] of Object.entries(usedFaces)) {
  const name = path.basename(uri, '.json');
  const cssName = 'rbx-' + name;
  const [web, generic] = WEB_FALLBACK[name] || [null, 'sans-serif'];
  let embedded = [];
  const famFile = fontsDir && path.join(fontsDir, 'families', name + '.json');
  if (famFile && fs.existsSync(famFile)) {
    const fam = JSON.parse(fs.readFileSync(famFile, 'utf8'));
    const local = (fam.faces || []).filter((f) => /^rbxasset:\/\/fonts\//.test(f.assetId) && fs.existsSync(path.join(fontsDir, f.assetId.slice('rbxasset://fonts/'.length))));
    const want = new Set();
    for (const key of faces) {
      const [w, st] = key.split('|');
      const pool = local.filter((f) => (f.style || 'normal') === st).length ? local.filter((f) => (f.style || 'normal') === st) : local;
      const best = pool.sort((a, b) => Math.abs(a.weight - w) - Math.abs(b.weight - w))[0];
      if (best) want.add(best);
    }
    for (const f of want) {
      const file = path.join(fontsDir, f.assetId.slice('rbxasset://fonts/'.length));
      const ext = path.extname(file).slice(1).toLowerCase();
      const b64 = fs.readFileSync(file).toString('base64');
      fontCss.push(`@font-face{font-family:'${cssName}';src:url(data:font/${ext === 'otf' ? 'otf' : 'ttf'};base64,${b64}) format('${ext === 'otf' ? 'opentype' : 'truetype'}');font-weight:${f.weight};font-style:${f.style || 'normal'};}`);
      embedded.push(`${path.basename(file)} (${f.weight})`);
    }
  }
  if (!embedded.length && web && web !== 'Arial') googleFamilies.add(web);
  const stack = [embedded.length ? `'${cssName}'` : null, web ? `'${web}'` : null, generic].filter(Boolean).join(', ');
  kitFonts[uri] = { css: stack, name, faces: [...faces].map((k) => { const [weight, style] = k.split('|'); return { weight, style }; }) };
  fontReport.push({ name, uri, embedded, web, stack });
}
fs.writeFileSync(path.join(ASSETS, 'fonts.css'), `/* fonts.css: Roblox fonts copied from the local Studio install (${fontsDir ? 'found' : 'not found'}) as data URIs, so file:// pages can use them. */\n` + fontCss.join('\n') + '\n');

// ---------- tokens ----------
function addTo(map, key, pth, extra) {
  const t = (map[key] ??= { count: 0, paths: [], roles: {} });
  t.count++;
  if (t.paths.length < 3 && !t.paths.includes(pth)) t.paths.push(pth);
  if (extra) t.roles[extra] = (t.roles[extra] || 0) + 1;
  return t;
}
const colors = {}, type = {}, radii = {}, strokes = {}, transp = {}, gradients = [];
for (const e of all) {
  const n = e.node, p = n.props || {}, pth = e.path;
  if (p.Size) {
    if (p.BackgroundTransparency < 1) addTo(colors, p.BackgroundColor3, pth, 'background');
    if (p.BorderSizePixel > 0 && p.BackgroundTransparency < 1) addTo(colors, p.BorderColor3, pth, 'border');
    if (p.Text && p.TextTransparency < 1) addTo(colors, p.TextColor3, pth, 'text');
    if (p.Text && p.TextStrokeTransparency < 1) addTo(colors, p.TextStrokeColor3, pth, 'text stroke');
    if (idOf(p.Image) && p.ImageColor3 && p.ImageColor3 !== '#ffffff') addTo(colors, p.ImageColor3, pth, 'image tint');
    if (p.FontFace && (p.Text || p.PlaceholderText)) {
      const c = modOf(n, 'UITextSizeConstraint');
      const size = p.TextScaled ? `scaled${c ? ` ${c.props.MinTextSize}–${c.props.MaxTextSize}` : ''}` : String(p.TextSize);
      const t = addTo(type, `${p.FontFace.family}|${p.FontFace.weight}|${p.FontFace.style}|${size}`, pth);
      t.sample ??= String(p.Text || p.PlaceholderText).slice(0, 40);
      t.font = p.FontFace; t.size = p.TextScaled ? Math.min(c?.props.MaxTextSize || 28, 28) : p.TextSize; t.sizeLabel = size;
    }
    const tv = (role, v) => { if (typeof v === 'number' && v > 0 && v < 1) addTo(transp, `${role}|${v.toFixed(2)}`, pth); };
    tv('BackgroundTransparency', p.BackgroundTransparency);
    if (idOf(p.Image)) tv('ImageTransparency', p.ImageTransparency);
    if (p.Text) tv('TextTransparency', p.TextTransparency);
    if (p.GroupTransparency !== undefined) tv('GroupTransparency', p.GroupTransparency);
  } else if (n.class === 'UICorner') {
    const r = p.CornerRadius || [0, 8];
    addTo(radii, r[0] ? `${r[0]} scale + ${r[1]} px` : `${r[1]} px`, e.path.replace(/\.UICorner$/, ''));
  } else if (n.class === 'UIStroke') {
    addTo(colors, p.Color, pth, 'UIStroke');
    const t = addTo(strokes, `${p.Color}|${+(+p.Thickness).toFixed(2)}|${+(+p.Transparency).toFixed(2)}|${p.ApplyStrokeMode}`, pth.replace(/\.UIStroke$/, ''));
    t.p = p;
  } else if (n.class === 'UIGradient') {
    for (const k of p.Color || []) addTo(colors, k[1], pth, 'gradient');
    gradients.push({ path: pth.replace(/\.UIGradient$/, ''), p });
  }
}
const gradCss = (p) => {
  const cs = p.Color || [], ts = p.Transparency || [];
  const alphaAt = (t) => { for (let i = 0; i < ts.length - 1; i++) if (t >= ts[i][0] && t <= ts[i + 1][0]) { const f = (t - ts[i][0]) / (ts[i + 1][0] - ts[i][0] || 1); return 1 - (ts[i][1] + (ts[i + 1][1] - ts[i][1]) * f); } return 1 - (ts.at(-1)?.[1] || 0); };
  return `linear-gradient(${90 + (p.Rotation || 0)}deg, ${cs.map(([t, c]) => { const v = parseInt(c.slice(1), 16); return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${alphaAt(t).toFixed(2)}) ${(t * 100).toFixed(0)}%`; }).join(', ')})`;
};

// ---------- components ----------
const C = (group, title, gui, sub, note = '') => ({ group, title, gui, names: sub.split('.'), path: (ui.guis.find((g) => g.key === gui)?.path || gui) + '.' + sub, note });
const components = [
  C('Buttons', 'Button template holder', 'StarterGui/ButtonTemplateHUD', 'Frame.Holder.Frame.ButtonHolder', 'The authored template ButtonTemplateView hides and clones.'),
  C('Buttons', 'Top-bar slot (Book)', 'StarterGui/TopHUD', 'Bar.BookSlot'),
  C('Buttons', 'Top-bar hide toggle', 'StarterGui/TopHUD', 'HideToggle'),
  C('Buttons', 'Play plate', 'ReplicatedFirst/PlayHUD', '1.PlayPlate'),
  C('Buttons', 'Save arrow', 'ReplicatedFirst/PlayHUD', '1.SaveLeft'),
  C('Buttons', 'Editor button (Done)', 'StarterGui/MobileLayoutEditor', 'TopCard.DoneButton'),
  C('Buttons', 'Bond panel button', 'StarterGui/GuardianBondHUD', 'Panel.Mask'),
  C('Quick slots', 'Quick slot', 'StarterGui/QuickSlotHUD', 'SlotBar.Slot1'),
  C('Quick slots', 'Quick slot bar', 'StarterGui/QuickSlotHUD', 'SlotBar'),
  C('Quick slots', 'Guardian form slot', 'StarterGui/WarderQuickSlotHUD', 'FormBar.Slot1'),
  C('Bars', 'Health bar', 'StarterGui/MainHUD', 'VitalsContainer.HealthBarBackground'),
  C('Bars', 'Mana bar', 'StarterGui/MainHUD', 'VitalsContainer.ManaBarBackground'),
  C('Bars', 'Guardian stamina bar', 'StarterGui/MainHUD', 'VitalsContainer.WarderStaminaBar'),
  C('Bars', 'Stamina bar', 'StarterGui/StaminaGui', 'BarHolder'),
  C('Bars', 'Top bar with XP', 'StarterGui/TopHUD', 'Bar'),
  C('Bars', 'Old XP container', 'StarterGui/MainHUD', 'XPContainer', 'Hidden at runtime by TopHUDController.'),
  C('Bars', 'Bond health bar', 'StarterGui/GuardianBondHUD', 'Panel.HealthBar'),
  C('Panels and cards', 'Book', 'StarterGui/NewBookHUD', 'BookHolderFrame.BookBackground'),
  C('Panels and cards', 'Book tab column', 'StarterGui/NewBookHUD', 'BookMenuFrame.TabColumn'),
  C('Panels and cards', 'Closed book', 'StarterGui/NewBookHUD', 'BookMenuFrame.ClosedBook'),
  C('Panels and cards', 'Shop', 'StarterGui/ShopHUD', 'Frame'),
  C('Panels and cards', 'Save card', 'ReplicatedFirst/PlayHUD', '1.SaveCard'),
  C('Panels and cards', 'Class choice card', 'ReplicatedFirst/SaveSlotHUD', 'Picker.ClassChoice.Channeler'),
  C('Panels and cards', 'Bond panel', 'StarterGui/GuardianBondHUD', 'Panel'),
  C('Panels and cards', 'Layout editor card', 'StarterGui/MobileLayoutEditor', 'TopCard'),
  C('Panels and cards', 'Tutorial text card', 'StarterGui/TutorialTextPosition', 'Frame.HolderforText'),
  C('Panels and cards', 'Guardian test panel', 'StarterGui/WarderTestHUD', 'Panel'),
  C('Mobile buttons', 'Channel button', 'StarterGui/MobileChannelHUD', 'Frame.ChannelButton'),
  C('Mobile buttons', 'Element button (Fire)', 'StarterGui/MobileElements', 'Frame.FireButton'),
  C('Mobile buttons', 'Element row', 'StarterGui/MobileElements', 'Frame'),
];
// Code-built pieces, rebuilt from the tokens parsed out of the module source.
if (tokOk.button) {
  const font = codeFont(tok.font);
  const btn = (label, strip, color) => ({
    class: 'TextButton', name: 'Button', props: { Size: [0, 240, 0, 42], BackgroundTransparency: 1, Text: label, TextTransparency: 1, FontFace: font, TextSize: 20, ZIndex: 3, Visible: true },
    children: [
      { class: 'ImageLabel', name: 'Strip', props: { Size: [1, 0, 1, 0], BackgroundTransparency: 1, Image: 'rbxassetid://' + strip, ScaleType: 'Slice', SliceCenter: tok.slice, SliceScale: tok.sliceScale, ZIndex: 3, Visible: true } },
      { class: 'TextLabel', name: 'Caption', props: { Position: [0.1, 0, 0.1, 0], Size: [0.84, 0, 0.8, 0], BackgroundTransparency: 1, Text: label, FontFace: font, TextColor3: color, TextScaled: true, TextWrapped: true, ZIndex: 4, Visible: true }, children: [{ class: 'UITextSizeConstraint', name: 'UITextSizeConstraint', props: { MinTextSize: 14, MaxTextSize: 20 } }] },
    ],
  });
  const src = code.ButtonTemplateView.path;
  components.unshift(
    { group: 'Buttons', title: 'Parchment word button', node: btn('Settings', tok.strip, tok.ink), w: 240, h: 42, path: src + '.Decorate()', note: `Built by ButtonTemplateView.Button/Decorate: ${tok.font}, ink ${tok.ink}, strip ${tok.strip} sliced ${tok.slice.join(',')} at ${tok.sliceScale}. Width here is a sample; in game it fills the page (UDim2.new(1,-4,0,42)).`, code: true },
    { group: 'Buttons', title: 'Parchment word button, chosen', node: btn('Weaves', tok.stripActive, tok.red), w: 240, h: 42, path: src + '.Decorate()', note: `Chosen state: text ${tok.red} swaps the strip to ${tok.stripActive}. Hover tints the strip ${tok.hover}.`, code: true },
  );
}
if (tokOk.top) {
  const s = tok.topSize, gap = tok.topSpacing || s + 8;
  const sq = (i) => ({ class: 'TextButton', name: 'TopButton' + (i + 1), props: { Position: [0, i * gap, 0, 0], Size: [0, s, 0, s], BackgroundColor3: tok.topColor, BackgroundTransparency: tok.topTransparency, BorderSizePixel: 0, Text: '', Visible: true, ZIndex: 1 }, children: [{ class: 'UICorner', name: 'UICorner', props: { CornerRadius: [0, 8] } }] });
  components.splice(tokOk.button ? 2 : 0, 0, { group: 'Buttons', title: 'Top-bar buttons (TopButtonTheme)', node: { class: 'Frame', name: 'Row', props: { Size: [0, gap * 2 + s, 0, s], BackgroundTransparency: 1, Visible: true }, children: [0, 1, 2].map(sq) }, w: gap * 2 + s, h: s, path: code.TopButtonTheme.path + '.Style()', note: `TopButtonTheme.Style: ${tok.topColor} at transparency ${tok.topTransparency}, ${s} px square, ${gap} px apart, no border. The corner here is illustrative; the theme sets none.`, code: true });
}
const findNode = (gui, names) => { let n = gui; for (const nm of names) { n = (n?.children || []).find((c) => c.name === nm); } return n; };
const compMissing = [];
for (const c of components) {
  if (c.node) { c.root = c.node; continue; }
  const g = ui.guis.find((x) => x.key === c.gui);
  c.root = g && findNode(g, c.names);
  if (!c.root) compMissing.push(c.path);
}
function keyProps(n) {
  const p = n.props || {}, out = [];
  const u2 = (v) => v && `{${+v[0].toFixed(3)}, ${v[1]}}, {${+v[2].toFixed(3)}, ${v[3]}}`;
  out.push(['Class', n.class]);
  if (p.Size) out.push(['Size', u2(p.Size)]);
  if (p.AnchorPoint && (p.AnchorPoint[0] || p.AnchorPoint[1])) out.push(['AnchorPoint', p.AnchorPoint.join(', ')]);
  if (p.BackgroundTransparency < 1) out.push(['Background', `${p.BackgroundColor3} @ ${+p.BackgroundTransparency.toFixed(2)}`]);
  if (idOf(p.Image)) out.push(['Image', `${idOf(p.Image)} · ${p.ScaleType}${p.ScaleType === 'Slice' ? ` ${p.SliceCenter.join(',')} @${+(+p.SliceScale).toFixed(2)}` : ''}${p.ImageColor3 && p.ImageColor3 !== '#ffffff' ? ' · tint ' + p.ImageColor3 : ''}`]);
  if (p.FontFace && p.Text) out.push(['Text', `${path.basename(p.FontFace.family, '.json')} ${p.FontFace.weight} · ${p.TextScaled ? 'scaled' : p.TextSize} · ${p.TextColor3}`]);
  const ms = (n.children || []).filter((c) => /^UI/.test(c.class)).map((c) => c.class.replace(/^UI/, ''));
  if (ms.length) out.push(['Modifiers', ms.join(', ')]);
  let count = 0; const cnt = (x) => { for (const c of x.children || []) { if (c.props?.Size) count++; cnt(c); } }; cnt(n);
  out.push(['Descendants', String(count) + ' GuiObjects']);
  return out;
}

// ---------- screens: status ----------
const RF_STATUS = { // ReplicatedFirst guis are not rows in client.md §5; owners from script_grep (PlayEntryClient:157, :345).
  'ReplicatedFirst/PlayHUD': { owner: 'ReplicatedFirst/PlayEntryClient', others: '–', purpose: 'Play screen, save cards and credits (the live copy)', status: 'Live (cloned into PlayerGui by PlayEntryClient)', statusKind: 'Live' },
  'ReplicatedFirst/SaveSlotHUD': { owner: 'ReplicatedFirst/PlayEntryClient (+ SaveCards)', others: '–', purpose: 'Save picker and Channeler/Guardian choice', status: 'Live (cloned as ActiveSaveSlotHUD)', statusKind: 'Live' },
};
const statusOf = (g) => RF_STATUS[g.key] || uiMap.byName[g.name] || { owner: '?', others: '', purpose: '', status: 'Not in docs/client.md §5', statusKind: 'Unknown' };
const KIND_ORDER = { Live: 0, 'Warder mode': 1, Legacy: 2, Unknown: 3 };
const screens = ui.guis.slice().sort((a, b) => KIND_ORDER[statusOf(a).statusKind] - KIND_ORDER[statusOf(b).statusKind] || (a.props.DisplayOrder || 0) - (b.props.DisplayOrder || 0));

// ---------- HTML ----------
const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const sw = (hex) => `<span class="sw" style="background:${esc(hex)}"></span>`;
const pathList = (ps) => ps.map((p) => `<code>${esc(p)}</code>`).join('<br>');
const fontStack = (f) => kitFonts[f.family]?.css || 'sans-serif';
const badge = (kind) => `<span class="badge b-${kind.replace(/\s/g, '-').toLowerCase()}">${esc(kind)}</span>`;

const colorRows = Object.entries(colors).sort((a, b) => b[1].count - a[1].count).map(([hex, t]) => `<tr><td>${sw(hex)}<code>${esc(hex)}</code></td><td class="num">${t.count}</td><td>${Object.entries(t.roles).map(([r, c]) => `${esc(r)} ${c}`).join(', ')}</td><td class="paths">${pathList(t.paths)}</td></tr>`).join('');
const typeRows = Object.values(type).sort((a, b) => b.count - a.count).map((t) => `<tr><td><span class="sample" style="font-family:${esc(fontStack(t.font))};font-weight:${WEIGHT[t.font.weight] || 400};font-style:${t.font.style === 'Italic' ? 'italic' : 'normal'};font-size:${t.size}px">${esc(t.sample)}</span></td><td>${esc(path.basename(t.font.family, '.json'))}</td><td>${esc(t.font.weight)}${t.font.style !== 'Normal' ? ' ' + esc(t.font.style) : ''}</td><td>${esc(t.sizeLabel)}</td><td class="num">${t.count}</td><td class="paths">${pathList(t.paths)}</td></tr>`).join('');
const radiusRows = Object.entries(radii).sort((a, b) => b[1].count - a[1].count).map(([k, t]) => { const px = /scale/.test(k) ? 12 : Math.min(parseFloat(k), 30); return `<tr><td><span class="radius" style="border-radius:${px}px"></span></td><td>${esc(k)}</td><td class="num">${t.count}</td><td class="paths">${pathList(t.paths)}</td></tr>`; }).join('');
const strokeRows = Object.entries(strokes).map(([k, t]) => { const [c, th, tr, mode] = k.split('|'); return `<tr><td><span class="stroke" style="box-shadow:0 0 0 ${th}px ${esc(c)};opacity:${1 - tr}"></span></td><td>${sw(c)}<code>${esc(c)}</code></td><td>${th} px</td><td>${tr}</td><td>${esc(mode)}</td><td class="num">${t.count}</td><td class="paths">${pathList(t.paths)}</td></tr>`; }).join('');
const gradRows = gradients.map((g) => `<tr><td><span class="grad" style="background:${esc(gradCss(g.p))}"></span></td><td>${(g.p.Color || []).map((k) => `${sw(k[1])}${(+k[0]).toFixed(2)}`).join(' ')}</td><td>${(g.p.Transparency || []).map((k) => `${(+k[0]).toFixed(2)}→${(+k[1]).toFixed(2)}`).join(', ')}</td><td>${g.p.Rotation}°</td><td class="paths"><code>${esc(g.path)}</code></td></tr>`).join('');
const transpRows = Object.entries(transp).sort().map(([k, t]) => { const [role, v] = k.split('|'); return `<tr><td><span class="sw" style="background:#e8e2d4;opacity:${1 - v}"></span></td><td>${esc(role)}</td><td>${v}</td><td class="num">${t.count}</td><td class="paths">${pathList(t.paths)}</td></tr>`; }).join('');
const imageCards = ids.sort((a, b) => imgUse[b].count - imgUse[a].count).map((id) => {
  const u = imgUse[id], k = kitImages[id], m = manifest[id];
  const st = Object.entries(u.scaleTypes).map(([s, c]) => `${s} ${c}`).join(', ') || 'code only';
  return `<figure class="img-card"><div class="thumb">${k ? `<img loading="lazy" src="${esc(k.file)}" alt="">` : `<span class="fail">not downloaded<br>${esc(m?.error || '')}</span>`}</div><figcaption><b>${esc(id)}</b> · ${u.count} use${u.count === 1 ? '' : 's'}${u.code ? ' + code' : ''}<br>${esc(st)}${u.slices.size ? `<br>slice ${[...u.slices].map(esc).join('; ')}` : ''}${u.rects ? `<br>rect crops ${u.rects}` : ''}${k ? `<br>file ${k.w}×${k.h} · native ${k.nw}×${k.nh} (${esc(k.how)})` : ''}<div class="paths">${pathList(u.paths)}</div></figcaption></figure>`;
}).join('');
const codeTokens = Object.entries(code).map(([name, m]) => {
  const lines = m.source.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /Color3\.|rbxassetid|Font\.|Rect\.new|Transparency =|Size =|Spacing =|SliceScale/.test(l));
  return `<h4><code>${esc(m.path)}</code></h4><table class="tbl"><tbody>${lines.map(([n, l]) => `<tr><td class="num">${n}</td><td>${[...l.matchAll(/fromRGB\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g)].map((x) => sw('#' + x.slice(1).map((v) => (+v).toString(16).padStart(2, '0')).join(''))).join('')}${[...l.matchAll(/rbxassetid:\/\/(\d+)/g)].map((x) => kitImages[x[1]] ? `<img class="mini" src="${esc(kitImages[x[1]].file)}" alt="">` : '').join('')}</td><td><code>${esc(l.trim())}</code></td></tr>`).join('')}</tbody></table>`;
}).join('');
const groups = [...new Set(components.map((c) => c.group))];
const compHtml = groups.map((g) => `<h3>${esc(g)}</h3><div class="comps">${components.map((c, i) => c.group !== g ? '' : `<article class="comp"><header><b>${esc(c.title)}</b>${c.code ? ' <span class="badge b-code">code-built</span>' : ''}</header><div class="comp-host" data-comp="${i}"></div><div class="muted small" id="compsize-${i}"></div><code class="src">${esc(c.path)}</code>${c.note ? `<p class="small">${esc(c.note)}</p>` : ''}${c.root ? `<dl class="kv">${keyProps(c.root).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '<p class="fail">Not found in the export.</p>'}</article>`).join('')}</div>`).join('');
const screenHtml = screens.map((g) => {
  const s = statusOf(g), p = g.props;
  const count = all.filter((e) => e.gui === g && e.node.props?.Size).length;
  const scripts = all.filter((e) => e.gui === g && /Script$/.test(e.node.class)).map((e) => e.node.name);
  return `<article class="scr" id="scr-${esc(g.key.replace(/\W/g, '-'))}"><header><h3>${esc(g.name)}</h3>${badge(s.statusKind)}<span class="muted">${esc(g.key)}</span></header>
<p class="small"><b>Owner:</b> ${esc(s.owner)}${s.others && s.others !== '–' ? ` · <b>Other writers:</b> ${esc(s.others)}` : ''}<br><b>Purpose:</b> ${esc(s.purpose)} · <b>Status:</b> ${esc(s.status)}</p>
<p class="small muted">Enabled ${p.Enabled} · DisplayOrder ${p.DisplayOrder} · IgnoreGuiInset ${p.IgnoreGuiInset} · ResetOnSpawn ${p.ResetOnSpawn} · ScreenInsets ${esc(p.ScreenInsets)} · ZIndexBehavior ${esc(p.ZIndexBehavior)} · ${count} GuiObjects${scripts.length ? ' · scripts inside: ' + esc(scripts.join(', ')) : ''}</p>
<div class="screen-host" data-screen="${esc(g.key)}"></div></article>`;
}).join('\n');
const runtimeRows = uiMap.runtime.map((r) => {
  const hits = ui.runtimeOwners?.[r.name] || [];
  const owners = hits.length ? hits.map((h) => `<code>${esc(h.path)}:${h.line}</code>${h.enabled === false ? ' (disabled)' : ''}`).join('<br>') : '<span class="muted">no string match in client scripts</span>';
  return `<tr><td><code>${esc(r.name)}</code></td><td>${esc(r.group)}</td><td>${owners}</td><td>${esc(r.note)}</td><td><span class="badge b-runtime">built at runtime, not rendered</span></td></tr>`;
}).join('');
const toc = [['header', 'About'], ['foundations', 'Foundations'], ['components', 'Components'], ['screens', 'Screens'], ['runtime', 'Runtime-built UI'], ['approx', 'Approximations']];
const staticApprox = [
  failed.length ? `${failed.length} image(s) could not be downloaded and draw as hatched boxes: ${failed.join(', ')}.` : 'Every referenced image was downloaded.',
  `Images are public thumbnails (${THUMB_SIZE} box, aspect kept), not the original files, so they can be softer than in game.`,
  `${approxCrops} sliced/cropped image(s) use a native size estimated from the thumbnail aspect (Studio could not open them with EditableImage); ${exactCrops} use the exact size from Studio.`,
  `Fonts: ${fontReport.map((f) => `${f.name} → ${f.embedded.length ? 'Roblox file ' + f.embedded.join(', ') : f.web ? 'web/system ' + f.web : 'generic fallback'}`).join('; ')}.`,
  'Text: Roblox TextSize is drawn as CSS font-size with line-height = TextSize × LineHeight; TextScaled is fitted with canvas text metrics.',
  'Layout: the top bar inset is 58 px when IgnoreGuiInset is false; safe-area insets (ScreenInsets, notches) are not modelled.',
  'Per-element ZIndex is honoured within each parent (Sibling); ZIndexBehavior Global is drawn the same way.',
  'StyleLink instances (CircleUIPosition, TutorialTextPosition) have no StyleSheet set and are ignored.',
  'Runtime changes made by scripts (text, fills, positions, ButtonTemplateView.Skin recolouring) are not applied: this is the authored state.',
];
const kitData = {
  guis: ui.guis, images: kitImages, tints, fonts: kitFonts,
  components: components.map((c) => ({ gui: c.gui, names: c.names, path: c.path, node: c.node, w: c.w, h: c.h })),
};
const inline = (s) => s.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Woven UI kit</title>
<link rel="stylesheet" href="assets/fonts.css">
${googleFamilies.size ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${[...googleFamilies].map((f) => 'family=' + f.replace(/ /g, '+') + ':wght@400;700').join('&')}&display=swap">` : ''}
<style>
:root{--bg:#141417;--panel:#1d1d22;--panel2:#26262d;--fg:#e9e6df;--muted:#9a978f;--line:#34343c;--accent:#d8b36a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}code{font:12px/1.3 ui-monospace,Consolas,monospace;color:#cfc9bb}
.top{position:sticky;top:0;z-index:50;background:rgba(20,20,23,.95);border-bottom:1px solid var(--line);display:flex;gap:16px;align-items:center;padding:8px 20px;flex-wrap:wrap}
.top nav a{margin-right:12px;text-decoration:none}.seg{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.seg button{background:none;border:0;color:var(--fg);padding:5px 10px;cursor:pointer;font:inherit}.seg button[aria-pressed=true]{background:var(--accent);color:#1b1408}
main{max-width:1240px;margin:0 auto;padding:20px}section{margin:0 0 48px}h2{border-bottom:1px solid var(--line);padding-bottom:6px}
.muted{color:var(--muted)}.small{font-size:12.5px}.num{text-align:right;font-variant-numeric:tabular-nums}.fail{color:#e07a6a}
.tbl-wrap{overflow-x:auto}.tbl{border-collapse:collapse;width:100%;font-size:13px}.tbl td,.tbl th{border-bottom:1px solid var(--line);padding:5px 8px;vertical-align:top;text-align:left}
.paths{font-size:11px;max-width:460px;word-break:break-all}
.sw{display:inline-block;width:22px;height:22px;border-radius:4px;border:1px solid rgba(255,255,255,.25);vertical-align:middle;margin-right:6px}
.sample{display:inline-block;max-width:360px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f2ead8}
.radius{display:inline-block;width:56px;height:36px;background:#5a5040;border:1px solid #8a7a5a}
.stroke{display:inline-block;width:56px;height:30px;background:#2b2b31;border-radius:3px;margin:4px}
.grad{display:inline-block;width:160px;height:26px;border-radius:4px;background-color:#000;border:1px solid var(--line)}
.imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.img-card{margin:0;background:var(--panel);border-radius:8px;padding:8px;font-size:12px}
.thumb{height:140px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#2a2a30 0 25%,#232328 0 50%) 0 0/16px 16px;border-radius:6px}
.thumb img{max-width:100%;max-height:140px}.mini{height:22px;vertical-align:middle;margin-right:6px;background:#333}
.comps{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px}
.comp{background:var(--panel);border-radius:8px;padding:12px}.comp header{margin-bottom:8px}
.comp-host{min-height:60px;display:flex;align-items:center;justify-content:center;padding:14px;background:repeating-conic-gradient(#2a2a30 0 25%,#232328 0 50%) 0 0/16px 16px;border-radius:6px;overflow:hidden}
.comp-wrap{position:relative}.comp-stage{position:absolute;left:0;top:0;transform-origin:0 0}
.src{display:block;margin-top:6px;word-break:break-all}.kv{display:grid;grid-template-columns:max-content 1fr;gap:2px 10px;font-size:12px;margin:8px 0 0}.kv dt{color:var(--muted)}.kv dd{margin:0;word-break:break-word}
.scr{background:var(--panel);border-radius:8px;padding:12px;margin-bottom:18px}.scr header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.scr h3{margin:0}
.screen-host{width:100%}.screen-wrap{position:relative;overflow:hidden;border-radius:4px;outline:1px solid var(--line)}
.screen{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;background:linear-gradient(160deg,#3c4a3a,#2a3340 55%,#1f2430)}
.topbar{position:absolute;left:0;top:0;right:0;border-bottom:1px dashed rgba(255,255,255,.35);background:rgba(0,0,0,.18);color:rgba(255,255,255,.55);font:16px system-ui;padding:6px 12px;z-index:0;pointer-events:none}
.disabled-note{position:absolute;inset:40% 10% auto;text-align:center;font:28px system-ui;color:rgba(255,255,255,.7)}
.rn-root{position:absolute;left:0}
.rn{position:absolute;box-sizing:border-box}.rn-folder{pointer-events:none}.rn-folder>.rn{pointer-events:auto}
.rn-img{position:absolute;inset:0;border-radius:inherit;box-sizing:border-box;pointer-events:none}
.rn-missing{background:repeating-linear-gradient(45deg,rgba(224,122,106,.35) 0 6px,transparent 6px 12px);outline:1px dashed #e07a6a}
.rn-text{position:absolute;inset:0;display:flex;flex-direction:column;overflow:visible;pointer-events:none;word-break:break-word}
.rn-text span{display:block;max-width:100%}
.rn-viewport{background-image:repeating-linear-gradient(-45deg,rgba(255,255,255,.08) 0 4px,transparent 4px 10px)}
.rn-hidden{outline:1px dashed rgba(120,200,255,.8);outline-offset:-1px}
.rn-hover{outline:2px solid #ffcc33 !important;outline-offset:-1px}
.badge{font-size:11px;border-radius:10px;padding:1px 8px;background:var(--panel2);white-space:nowrap}.b-live{background:#24563a}.b-warder-mode{background:#4b3b6e}.b-legacy{background:#6a3a2c}.b-unknown{background:#555}.b-code{background:#5a4a20}.b-runtime{background:#3a3f4f}
#tip{position:fixed;z-index:100;background:#000;color:#fff;font:12px/1.35 ui-monospace,Consolas,monospace;padding:6px 8px;border-radius:5px;white-space:pre;pointer-events:none;max-width:70vw;overflow:hidden;text-overflow:ellipsis}
</style></head><body>
<div class="top"><b>Woven UI kit</b><nav>${toc.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>
<span class="seg" role="group" aria-label="Viewport"><button data-vp="desktop" aria-pressed="false">1920×1080</button><button data-vp="laptop" aria-pressed="true">1280×720</button><button data-vp="phone" aria-pressed="false">Phone 844×390</button></span>
<label><input type="checkbox" id="show-hidden"> show hidden elements</label></div>
<main>
<section id="header"><h1>Woven UI kit</h1>
<p>The authored UI of <b>${esc(ui.placeName)}</b> (PlaceId ${esc(ui.placeId)}, GameId ${esc(ui.gameId)}, place version ${esc(ui.placeVersion)}), rendered from a read-only export of Roblox Studio. It shows every ScreenGui in StarterGui and the ReplicatedFirst PlayHUD and SaveSlotHUD as they are authored, before any script changes them.</p>
<p class="small muted">Exported ${esc(ui.exportedAt)} · page built ${now} · ${ui.guis.length} ScreenGuis · ${guiObjects.length} GuiObjects · ${Object.keys(colors).length} colours · ${Object.keys(type).length} type styles · ${ids.length} images.<br>
Rebuild: see <a href="../../tools/ui-kit/README.md">tools/ui-kit/README.md</a> (export through the roblox-studio MCP, then <code>node tools/ui-kit/build.mjs</code>). Hover any element in a component or screen to see its path and size.</p></section>

<section id="foundations"><h2>Foundations</h2>
<h3>Colour palette</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Colour</th><th>Uses</th><th>Roles</th><th>Examples</th></tr></thead><tbody>${colorRows}</tbody></table></div>
<h3>Typography</h3><p class="small muted">Font family, weight and size. "scaled" means TextScaled, with the UITextSizeConstraint range when one exists.</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sample</th><th>Family</th><th>Weight</th><th>Size</th><th>Uses</th><th>Examples</th></tr></thead><tbody>${typeRows}</tbody></table></div>
<h3>Corner radii (UICorner)</h3><div class="tbl-wrap"><table class="tbl"><tbody>${radiusRows}</tbody></table></div>
<h3>Strokes (UIStroke)</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Colour</th><th>Thickness</th><th>Transparency</th><th>Mode</th><th>Uses</th><th>Examples</th></tr></thead><tbody>${strokeRows}</tbody></table></div>
<h3>Gradients (UIGradient)</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Colour keys</th><th>Transparency keys</th><th>Rotation</th><th>On</th></tr></thead><tbody>${gradRows}</tbody></table></div>
<h3>Transparency levels</h3><p class="small muted">Values strictly between 0 and 1.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Property</th><th>Value</th><th>Uses</th><th>Examples</th></tr></thead><tbody>${transpRows}</tbody></table></div>
<h3>Code-defined tokens</h3><p class="small muted">Lines from the shared modules that set fonts, colours and images in code. Parsed from the exported source on each build.</p>${codeTokens}
<h3>Image library</h3><div class="imgs">${imageCards}</div></section>

<section id="components"><h2>Components</h2><p class="small muted">Each piece is laid out at a 1280×720 screen and drawn on its own. Code-built pieces are rebuilt from the tokens above.</p>${compHtml}</section>

<section id="screens"><h2>Screens</h2><p class="small muted">Each ScreenGui on its own mock screen. Hidden elements (Visible = false) and disabled guis are skipped until you tick "show hidden elements"; then hidden elements get a dashed blue outline. Status and owner come from docs/client.md §5.</p>
${screenHtml}</section>

<section id="runtime"><h2>Runtime-built UI</h2><p class="small muted">Guis built in code (docs/client.md §5). Owners are client scripts that name the gui in a string literal, found by the export scan.</p>
<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Gui</th><th>Group</th><th>Scripts that name it</th><th>Doc note</th><th></th></tr></thead><tbody>${runtimeRows}</tbody></table></div></section>

<section id="approx"><h2>Approximations</h2><ul>${staticApprox.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
<h4>Hit by the current view</h4><ul id="approx-live"><li>Rendering…</li></ul></section>
</main>
<div id="tip" hidden></div>
<script>window.KIT=${JSON.stringify(kitData).replace(/</g, '\\u003c')};</script>
<script>${inline(fs.readFileSync(path.join(TOOLS, 'renderer.js'), 'utf8'))}</script>
<script>${inline(fs.readFileSync(path.join(TOOLS, 'page.js'), 'utf8'))}</script>
</body></html>
`;
fs.writeFileSync(path.join(KIT_DIR, 'index.html'), html);

// ---------- summary ----------
const unmapped = ui.guis.filter((g) => statusOf(g).statusKind === 'Unknown').map((g) => g.key);
console.log([
  `ScreenGuis exported: ${ui.guis.length}`,
  `GuiObjects exported: ${guiObjects.length}`,
  `Distinct colours: ${Object.keys(colors).length} · type styles: ${Object.keys(type).length} (families: ${fontReport.map((f) => f.name).join(', ')}) · images: ${ids.length}`,
  `Images: ${downloaded} downloaded this run, ${ids.length - failed.length} on disk, ${failed.length} failed${failed.length ? ' (' + failed.map((id) => `${id}: ${manifest[id]?.error}`).join('; ') + ')' : ''}`,
  `Tinted variants: ${Object.keys(tints).length} written/kept, ${tintFailed} failed`,
  `Slice/rect images: ${exactCrops} exact native size, ${approxCrops} estimated`,
  `Fonts: ${fontReport.map((f) => `${f.name}=${f.embedded.length ? 'embedded ' + f.embedded.length : f.web || 'generic'}`).join(', ')}${fontsDir ? '' : ' (Studio fonts dir not found)'}`,
  `Components: ${components.length} (${compMissing.length} missing${compMissing.length ? ': ' + compMissing.join(', ') : ''}) · code tokens parsed: button ${tokOk.button}, top bar ${tokOk.top}`,
  `Screens without a client.md status: ${unmapped.length ? unmapped.join(', ') : 'none'}`,
  `Wrote ${rel(path.join(KIT_DIR, 'index.html'))} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`,
].join('\n'));
