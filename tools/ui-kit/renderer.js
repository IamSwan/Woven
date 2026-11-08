// renderer.js: lays out exported Roblox UI (UDim2 sizes plus UI modifiers) as absolutely positioned DOM for the
// UI kit page. Inlined into docs/ui-kit/index.html by build.mjs; reads window.KIT. Approximations are counted in
// KIT_APPROX and listed on the page.
(function () {
  'use strict';
  const KIT = window.KIT;
  const TOPBAR = 58; // Roblox top bar inset when IgnoreGuiInset is false
  const approx = (window.KIT_APPROX = {});
  const note = (k) => { approx[k] = (approx[k] || 0) + 1; };
  const WEIGHT = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Heavy: 900 };

  // ---------- helpers ----------
  const isGui = (n) => !!(n.props && n.props.Size);
  const isText = (n) => n.class === 'TextLabel' || n.class === 'TextButton' || n.class === 'TextBox';
  const isImage = (n) => n.class === 'ImageLabel' || n.class === 'ImageButton';
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const shown = (n, ctx) => n.props.Visible !== false || ctx.showHidden || n === ctx.forceRoot;
  function mods(n) {
    if (!n._mods) {
      n._mods = {};
      for (const c of n.children || []) {
        if (!/^UI/.test(c.class) || n._mods[c.class]) continue;
        if (c.props && c.props.Enabled === false) continue;
        n._mods[c.class] = c.props || {};
      }
    }
    return n._mods;
  }
  const udim = (u, size) => (u ? u[0] * size + u[1] : 0);
  function rgba(hex, transparency) {
    const v = parseInt((hex || '#000000').slice(1), 16);
    const a = 1 - num(transparency, 0);
    return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }
  function mul(hexA, hexB) {
    const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
    const c = (s) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
    return '#' + [16, 8, 0].map((s) => c(s).toString(16).padStart(2, '0')).join('');
  }
  // CSS linear-gradient for a UIGradient over a base colour/transparency.
  function gradientCss(g, baseHex, baseT) {
    const cs = g.Color || [[0, '#ffffff'], [1, '#ffffff']];
    const ts = g.Transparency || [[0, 0, 0], [1, 0, 0]];
    const times = [...new Set([...cs.map((k) => k[0]), ...ts.map((k) => k[0])])].sort((a, b) => a - b);
    const at = (seq, t, pick) => {
      for (let i = 0; i < seq.length - 1; i++) {
        if (t >= seq[i][0] && t <= seq[i + 1][0]) {
          const f = (t - seq[i][0]) / (seq[i + 1][0] - seq[i][0] || 1);
          return pick(seq[i], seq[i + 1], f);
        }
      }
      return pick(seq[seq.length - 1], seq[seq.length - 1], 0);
    };
    const lerpHex = (a, b, f) => {
      const x = parseInt(a[1].slice(1), 16), y = parseInt(b[1].slice(1), 16);
      const ch = (s) => Math.round(((x >> s) & 255) + ((((y >> s) & 255) - ((x >> s) & 255)) * f));
      return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
    };
    const stops = times.map((t) => {
      const c = at(cs, t, lerpHex);
      const tr = at(ts, t, (a, b, f) => a[1] + (b[1] - a[1]) * f);
      const total = 1 - (1 - num(baseT, 0)) * (1 - tr);
      return `${rgba(mul(c, baseHex), total)} ${(t * 100).toFixed(1)}%`;
    });
    if (g.Offset && (g.Offset[0] || g.Offset[1])) note('UIGradient Offset ignored');
    return `linear-gradient(${90 + num(g.Rotation, 0)}deg, ${stops.join(', ')})`;
  }

  // ---------- text ----------
  const canvas = document.createElement('canvas').getContext('2d');
  function fontOf(p, size) {
    const f = p.FontFace || {};
    const fam = (KIT.fonts[f.family] || { css: 'sans-serif' }).css;
    return `${f.style === 'Italic' ? 'italic ' : ''}${WEIGHT[f.weight] || 400} ${size}px ${fam}`;
  }
  const plain = (p) => (p.RichText ? String(p.Text).replace(/<[^>]*>/g, '') : String(p.Text));
  function wrapLines(text, font, w) {
    canvas.font = font;
    const out = [];
    for (const para of text.split('\n')) {
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        const t = line + word;
        if (line && canvas.measureText(t.trimEnd()).width > w) { out.push(line.trimEnd()); line = word.trimStart(); }
        else line = t;
      }
      out.push(line);
    }
    return out;
  }
  function fits(text, p, size, w, h) {
    const font = fontOf(p, size);
    const lines = wrapLines(text, font, w);
    canvas.font = font;
    const widest = Math.max(...lines.map((l) => canvas.measureText(l).width));
    return lines.length * size * num(p.LineHeight, 1) <= h + 0.5 && widest <= w + 0.5;
  }
  function scaledSize(n, w, h) {
    const p = n.props;
    const text = plain(p) || ' ';
    const c = mods(n).UITextSizeConstraint;
    let lo = 1, hi = 100;
    if (c) { hi = Math.min(hi, num(c.MaxTextSize, 100)); }
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(text, p, mid, w, h)) lo = mid; else hi = mid - 1; }
    if (c) lo = Math.max(lo, num(c.MinTextSize, 1));
    return lo;
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // Roblox rich text to safe HTML: only b, i, u, s, br and font color/size/weight are kept.
  function rich(text) {
    let out = esc(text);
    out = out.replace(/&lt;(\/?)(b|i|u|s)&gt;/g, '<$1$2>').replace(/&lt;br\s*\/?&gt;/g, '<br>');
    out = out.replace(/&lt;font([^&]*?)&gt;/g, (_, a) => {
      const st = [];
      const color = a.match(/color=&quot;(#[0-9a-fA-F]{6})&quot;|color="(#[0-9a-fA-F]{6})"/);
      const size = a.match(/size=&quot;(\d+)&quot;|size="(\d+)"/);
      if (color) st.push('color:' + (color[1] || color[2]));
      if (size) st.push('font-size:' + (size[1] || size[2]) + 'px');
      return `<span style="${st.join(';')}">`;
    }).replace(/&lt;\/font&gt;/g, '</span>');
    if (/&lt;\w/.test(out)) note('RichText tags beyond b/i/u/s/br/font shown as text');
    return out;
  }

  // ---------- layout ----------
  function sizeOf(n, pw, ph) {
    const p = n.props;
    const s = p.Size || [0, 0, 0, 0];
    let rw = pw, rh = ph;
    if (p.SizeConstraint === 'RelativeXX') rh = pw;
    else if (p.SizeConstraint === 'RelativeYY') rw = ph;
    let w = s[0] * rw + s[1], h = s[2] * rh + s[3];
    if (p.AutomaticSize && p.AutomaticSize !== 'None') note('AutomaticSize not modelled');
    const m = mods(n);
    const ar = m.UIAspectRatioConstraint;
    if (ar && num(ar.AspectRatio, 0) > 0) {
      const r = ar.AspectRatio;
      if (ar.AspectType === 'ScaleWithParentSize') {
        note('UIAspectRatioConstraint ScaleWithParentSize treated as fit-in-parent');
        w = pw; h = ph;
      }
      if (w / (h || 1e-9) > r) w = h * r; else h = w / r;
    }
    const sc = m.UISizeConstraint;
    if (sc) {
      const mn = sc.MinSize || [0, 0], mx = sc.MaxSize || [Infinity, Infinity];
      w = Math.min(Math.max(w, num(mn[0], 0)), num(mx[0], Infinity));
      h = Math.min(Math.max(h, num(mn[1], 0)), num(mx[1], Infinity));
    }
    return { w: Math.max(0, w), h: Math.max(0, h) };
  }
  function padding(n, w, h) {
    const pd = mods(n).UIPadding;
    if (!pd) return { l: 0, r: 0, t: 0, b: 0 };
    return { l: udim(pd.PaddingLeft, w), r: udim(pd.PaddingRight, w), t: udim(pd.PaddingTop, h), b: udim(pd.PaddingBottom, h) };
  }
  // Content box for children: padding, and the canvas for a ScrollingFrame.
  function content(n, w, h) {
    const pd = padding(n, w, h);
    let cw = w - pd.l - pd.r, ch = h - pd.t - pd.b, ox = pd.l, oy = pd.t;
    if (n.class === 'ScrollingFrame') {
      const cs = n.props.CanvasSize || [0, 0, 0, 0];
      cw = Math.max(cw, cs[0] * w + cs[1]);
      ch = Math.max(ch, cs[2] * h + cs[3]);
      const cp = n.props.CanvasPosition || [0, 0];
      ox -= cp[0]; oy -= cp[1];
    }
    return { cw, ch, ox, oy };
  }
  function sorted(kids, order) {
    const idx = new Map(kids.map((k, i) => [k, i]));
    return kids.slice().sort((a, b) => order === 'Name'
      ? (a.name < b.name ? -1 : a.name > b.name ? 1 : idx.get(a) - idx.get(b))
      : (num(a.props.LayoutOrder, 0) - num(b.props.LayoutOrder, 0)) || idx.get(a) - idx.get(b));
  }
  const alignStart = (mode, avail, used) => (/Center/.test(mode || '') ? (avail - used) / 2 : /Right|Bottom/.test(mode || '') ? avail - used : 0);
  // Returns [{child, x, y, w, h}] for the children of n inside a cw x ch content box.
  function place(n, cw, ch, ctx) {
    const kids = (n.children || []).filter((c) => (isGui(c) && shown(c, ctx)) || c.class === 'Folder');
    const m = mods(n);
    const out = [];
    for (const f of kids) if (f.class === 'Folder') out.push({ child: f, x: 0, y: 0, w: cw, h: ch });
    const items = kids.filter(isGui);
    const list = m.UIListLayout, grid = m.UIGridLayout;
    if (list) {
      if (list.Wraps || (list.HorizontalFlex && list.HorizontalFlex !== 'None') || (list.VerticalFlex && list.VerticalFlex !== 'None')) note('UIListLayout wrap/flex not modelled');
      const vert = list.FillDirection !== 'Horizontal';
      const ord = sorted(items, list.SortOrder);
      const sizes = ord.map((c) => sizeOf(c, cw, ch));
      const pad = udim(list.Padding, vert ? ch : cw);
      const used = sizes.reduce((s, z) => s + (vert ? z.h : z.w), 0) + pad * Math.max(0, ord.length - 1);
      let cur = alignStart(vert ? list.VerticalAlignment : list.HorizontalAlignment, vert ? ch : cw, used);
      ord.forEach((c, i) => {
        const z = sizes[i];
        const cross = alignStart(vert ? list.HorizontalAlignment : list.VerticalAlignment, vert ? cw : ch, vert ? z.w : z.h);
        out.push(vert ? { child: c, x: cross, y: cur, w: z.w, h: z.h } : { child: c, x: cur, y: cross, w: z.w, h: z.h });
        cur += (vert ? z.h : z.w) + pad;
      });
    } else if (grid) {
      const cell = grid.CellSize || [0, 100, 0, 100], cp = grid.CellPadding || [0, 5, 0, 5];
      const gw = cell[0] * cw + cell[1], gh = cell[2] * ch + cell[3];
      const px = cp[0] * cw + cp[1], py = cp[2] * ch + cp[3];
      const horiz = grid.FillDirection !== 'Vertical';
      const fit = Math.max(1, Math.floor(horiz ? (cw + px) / (gw + px) : (ch + py) / (gh + py)));
      const per = grid.FillDirectionMaxCells > 0 ? Math.min(fit, grid.FillDirectionMaxCells) : fit;
      const ord = sorted(items, grid.SortOrder);
      const cols = horiz ? Math.min(per, ord.length) : Math.ceil(ord.length / per);
      const rows = horiz ? Math.ceil(ord.length / per) : Math.min(per, ord.length);
      const ox = alignStart(grid.HorizontalAlignment, cw, cols * gw + (cols - 1) * px);
      const oy = alignStart(grid.VerticalAlignment, ch, rows * gh + (rows - 1) * py);
      if (grid.StartCorner && grid.StartCorner !== 'TopLeft') note('UIGridLayout StartCorner other than TopLeft');
      ord.forEach((c, i) => {
        const col = horiz ? i % per : Math.floor(i / per), row = horiz ? Math.floor(i / per) : i % per;
        const z = sizeOf(Object.assign({}, c, { props: Object.assign({}, c.props, { Size: [0, gw, 0, gh] }) }), cw, ch);
        out.push({ child: c, x: ox + col * (gw + px), y: oy + row * (gh + py), w: z.w, h: z.h });
      });
    } else {
      for (const c of items) {
        const z = sizeOf(c, cw, ch);
        const pos = c.props.Position || [0, 0, 0, 0], ap = c.props.AnchorPoint || [0, 0];
        out.push({ child: c, x: pos[0] * cw + pos[1] - ap[0] * z.w, y: pos[2] * ch + pos[3] - ap[1] * z.h, w: z.w, h: z.h });
      }
    }
    return out;
  }

  // ---------- images ----------
  function imageLayer(n, w, h) {
    const p = n.props;
    const id = ((p.Image || '').match(/(\d{5,})/) || [])[1];
    if (!id) return null;
    const img = KIT.images[id];
    const layer = document.createElement('div');
    layer.className = 'rn-img';
    layer.style.opacity = String(1 - num(p.ImageTransparency, 0));
    if (!img || !img.file) {
      layer.classList.add('rn-missing');
      layer.textContent = 'image unavailable · ' + id;
      return layer;
    }
    let file = img.file;
    const tint = p.ImageColor3 && p.ImageColor3 !== '#ffffff' ? KIT.tints[id + '_' + p.ImageColor3.slice(1)] : null;
    if (p.ImageColor3 && p.ImageColor3 !== '#ffffff') { if (tint) file = tint; else note('ImageColor3 tint not applied'); }
    const url = `url("${file}")`;
    if (p.ResampleMode === 'Pixelated') layer.style.imageRendering = 'pixelated';
    const rs = p.ImageRectSize || [0, 0], ro = p.ImageRectOffset || [0, 0];
    const st = p.ScaleType || 'Stretch';
    if (st === 'Slice') {
      const sc = p.SliceCenter || [0, 0, 0, 0];
      if (sc[2] > sc[0] && sc[3] > sc[1]) {
        if (!img.exact) note('Slice on an image with estimated native size');
        const k = img.w / img.nw, ss = num(p.SliceScale, 1);
        const L = sc[0], T = sc[1], R = img.nw - sc[2], B = img.nh - sc[3];
        const wd = `${T * ss}px ${R * ss}px ${B * ss}px ${L * ss}px`;
        layer.style.borderStyle = 'solid';
        layer.style.borderColor = 'transparent';
        layer.style.borderWidth = wd;
        layer.style.borderImage = `${url} ${T * k} ${R * k} ${B * k} ${L * k} fill / ${wd} stretch`;
        return layer;
      }
    }
    layer.style.backgroundImage = url;
    layer.style.backgroundRepeat = 'no-repeat';
    if (rs[0] > 0 && rs[1] > 0) {
      if (!img.exact) note('ImageRect crop on an image with estimated native size');
      const fx = w / rs[0], fy = h / rs[1];
      layer.style.backgroundSize = `${img.nw * fx}px ${img.nh * fy}px`;
      layer.style.backgroundPosition = `${-ro[0] * fx}px ${-ro[1] * fy}px`;
      if (st !== 'Stretch' && st !== 'Slice') note('ImageRect crop with Fit/Crop/Tile drawn as Stretch');
    } else if (st === 'Fit') { layer.style.backgroundSize = 'contain'; layer.style.backgroundPosition = 'center'; }
    else if (st === 'Crop') { layer.style.backgroundSize = 'cover'; layer.style.backgroundPosition = 'center'; }
    else if (st === 'Tile') {
      const t = p.TileSize || [1, 0, 1, 0];
      layer.style.backgroundRepeat = 'repeat';
      layer.style.backgroundSize = `${t[0] * w + t[1]}px ${t[2] * h + t[3]}px`;
    } else layer.style.backgroundSize = '100% 100%';
    return layer;
  }

  // ---------- render ----------
  // Renders node n at rect r (relative to parentEl) and its subtree.
  function render(n, parentEl, r, ctx) {
    const el = document.createElement('div');
    el.className = 'rn';
    el.dataset.path = ctx.prefix + '.' + n.name;
    el.dataset.cls = n.class;
    el.style.left = r.x + 'px'; el.style.top = r.y + 'px';
    el.style.width = r.w + 'px'; el.style.height = r.h + 'px';
    parentEl.appendChild(el);
    if (n.class === 'Folder') {
      el.classList.add('rn-folder');
      const sub = Object.assign({}, ctx, { prefix: el.dataset.path });
      for (const e of place(n, r.w, r.h, ctx)) render(e.child, el, e, sub);
      return el;
    }
    const p = n.props;
    const m = mods(n);
    el.dataset.wh = `${Math.round(r.w)}×${Math.round(r.h)}`;
    if (p.Visible === false) el.classList.add('rn-hidden');
    el.style.zIndex = String(num(p.ZIndex, 1));
    const tf = [];
    if (num(p.Rotation, 0)) tf.push(`rotate(${p.Rotation}deg)`);
    if (m.UIScale && num(m.UIScale.Scale, 1) !== 1) {
      const ap = p.AnchorPoint || [0, 0];
      el.style.transformOrigin = `${ap[0] * 100}% ${ap[1] * 100}%`;
      tf.push(`scale(${m.UIScale.Scale})`);
    }
    if (tf.length) el.style.transform = tf.join(' ');
    const bgT = num(p.BackgroundTransparency, 0);
    const grad = m.UIGradient;
    if (bgT < 1) {
      el.style.background = grad ? gradientCss(grad, p.BackgroundColor3 || '#ffffff', bgT) : rgba(p.BackgroundColor3, bgT);
    }
    const shadows = [];
    if (num(p.BorderSizePixel, 0) > 0 && bgT < 1) shadows.push(`0 0 0 ${p.BorderSizePixel}px ${rgba(p.BorderColor3, bgT)}`);
    const stroke = m.UIStroke;
    const textStroke = stroke && isText(n) && stroke.ApplyStrokeMode !== 'Border';
    if (stroke && !textStroke) shadows.push(`0 0 0 ${num(stroke.Thickness, 1)}px ${rgba(stroke.Color, stroke.Transparency)}`);
    if (shadows.length) el.style.boxShadow = shadows.join(', ');
    if (m.UICorner) {
      const cr = m.UICorner.CornerRadius || [0, 8];
      el.style.borderRadius = Math.min(udim(cr, Math.min(r.w, r.h)), Math.min(r.w, r.h) / 2) + 'px';
    }
    if (p.ClipsDescendants || n.class === 'ScrollingFrame' || n.class === 'CanvasGroup') el.style.overflow = 'hidden';
    if (n.class === 'CanvasGroup') {
      el.style.opacity = String(1 - num(p.GroupTransparency, 0));
      if (p.GroupColor3 && p.GroupColor3 !== '#ffffff') note('CanvasGroup GroupColor3 ignored');
    }
    if (isImage(n)) { const l = imageLayer(n, r.w, r.h); if (l) el.appendChild(l); if (grad) note('UIGradient on an image ignored'); }
    if (isText(n)) {
      let text = String(p.Text || '');
      let color = p.TextColor3, tt = p.TextTransparency;
      if (!text && n.class === 'TextBox' && p.PlaceholderText) { text = p.PlaceholderText; color = p.PlaceholderColor3; tt = 0; }
      if (text) {
        const box = document.createElement('div');
        box.className = 'rn-text';
        const size = p.TextScaled ? scaledSize(Object.assign({}, n, { props: Object.assign({}, p, { Text: text }) }), r.w, r.h) : num(p.TextSize, 14);
        box.style.font = fontOf(p, size);
        box.style.lineHeight = size * num(p.LineHeight, 1) + 'px';
        box.style.color = rgba(color, tt);
        box.style.whiteSpace = p.TextWrapped || p.TextScaled ? 'pre-wrap' : 'pre';
        box.style.justifyContent = { Top: 'flex-start', Bottom: 'flex-end' }[p.TextYAlignment] || 'center';
        box.style.alignItems = { Left: 'flex-start', Right: 'flex-end' }[p.TextXAlignment] || 'center';
        box.style.textAlign = { Left: 'left', Right: 'right' }[p.TextXAlignment] || 'center';
        const span = document.createElement('span');
        if (p.RichText) span.innerHTML = rich(text); else span.textContent = text;
        if (num(p.TextStrokeTransparency, 1) < 1) {
          const c = rgba(p.TextStrokeColor3, p.TextStrokeTransparency);
          span.style.textShadow = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([x, y]) => `${x}px ${y}px 0 ${c}`).join(',');
        }
        if (textStroke) {
          span.style.webkitTextStroke = `${num(stroke.Thickness, 1) * 2}px ${rgba(stroke.Color, stroke.Transparency)}`;
          span.style.paintOrder = 'stroke fill';
        }
        if (grad) {
          span.style.backgroundImage = gradientCss(grad, color || '#ffffff', tt);
          span.style.webkitBackgroundClip = 'text'; span.style.backgroundClip = 'text';
          span.style.color = 'transparent';
        }
        box.appendChild(span);
        el.appendChild(box);
      }
    }
    if (n.class === 'ViewportFrame' || n.class === 'VideoFrame') { el.classList.add('rn-viewport'); note(n.class + ' content not rendered'); }
    const c = content(n, r.w, r.h);
    const sub = Object.assign({}, ctx, { prefix: el.dataset.path });
    for (const e of place(n, c.cw, c.ch, ctx)) render(e.child, el, { child: e.child, x: e.x + c.ox, y: e.y + c.oy, w: e.w, h: e.h }, sub);
    return el;
  }

  // ---------- public ----------
  const insetOf = (gui) => (gui.props.IgnoreGuiInset ? 0 : TOPBAR);
  function renderScreen(gui, host, W, H, ctx) {
    host.innerHTML = '';
    const scale = Math.min(1, host.clientWidth / W);
    const wrap = document.createElement('div');
    wrap.className = 'screen-wrap';
    wrap.style.width = W * scale + 'px'; wrap.style.height = H * scale + 'px';
    const scr = document.createElement('div');
    scr.className = 'screen';
    scr.style.width = W + 'px'; scr.style.height = H + 'px';
    scr.style.transform = `scale(${scale})`;
    wrap.appendChild(scr); host.appendChild(wrap);
    const bar = document.createElement('div');
    bar.className = 'topbar'; bar.style.height = TOPBAR + 'px';
    bar.textContent = gui.props.IgnoreGuiInset ? 'Roblox top bar (IgnoreGuiInset: gui draws under it)' : 'Roblox top bar (gui starts below)';
    scr.appendChild(bar);
    if (gui.props.Enabled === false && !ctx.showHidden) {
      const o = document.createElement('div');
      o.className = 'disabled-note';
      o.textContent = 'ScreenGui.Enabled = false. Turn on "show hidden elements" to render it.';
      scr.appendChild(o);
      return;
    }
    if (gui.props.ZIndexBehavior === 'Global') note('ZIndexBehavior Global drawn as Sibling');
    const inset = insetOf(gui);
    const root = document.createElement('div');
    root.className = 'rn-root';
    root.style.top = inset + 'px'; root.style.width = W + 'px'; root.style.height = H - inset + 'px';
    scr.appendChild(root);
    const sub = Object.assign({}, ctx, { prefix: gui.path });
    for (const e of place(gui, W, H - inset, ctx)) render(e.child, root, e, sub);
  }
  // Finds a node by child names under gui and returns its rect at W x H.
  function locate(gui, names, W, H) {
    let node = gui, cw = W, ch = H - insetOf(gui), rect = null;
    const ctx = { showHidden: true };
    for (const name of names) {
      const hit = place(node, cw, ch, ctx).find((e) => e.child.name === name);
      if (!hit) return null;
      rect = hit; node = hit.child;
      if (node.class !== 'Folder') { const c = content(node, hit.w, hit.h); cw = c.cw; ch = c.ch; }
    }
    return rect && { node, w: rect.w, h: rect.h };
  }
  function renderComponent(node, w, h, host, ctx, path) {
    host.innerHTML = '';
    const scale = Math.min(2, 320 / (w || 1), 200 / (h || 1));
    const wrap = document.createElement('div');
    wrap.className = 'comp-wrap';
    wrap.style.width = w * scale + 'px'; wrap.style.height = h * scale + 'px';
    const stage = document.createElement('div');
    stage.className = 'comp-stage';
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    stage.style.transform = `scale(${scale})`;
    wrap.appendChild(stage); host.appendChild(wrap);
    const parentPath = path.split('.').slice(0, -1).join('.');
    render(node, stage, { x: 0, y: 0, w, h }, Object.assign({}, ctx, { forceRoot: node, prefix: parentPath }));
    return scale;
  }
  window.KitRenderer = { renderScreen, renderComponent, locate, sizeOf };
})();
