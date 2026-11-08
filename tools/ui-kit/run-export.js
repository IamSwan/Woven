// run-export.js: paste this whole file as the `code` of the MCP Code Mode `execute` tool while
// `node tools/ui-kit/receive.mjs` runs. It pulls export.luau from the receiver, runs it read-only in
// Studio (Edit) once per ScreenGui, posts each chunk to the receiver, and returns a short summary.
(async () => {
  const BASE = 'http://127.0.0.1:47821';
  const studio = await tools['roblox-studio'].list_roblox_studios();
  const sid = (studio.studios || []).find((s) => /Woven/.test(s.name))?.id;
  if (!sid) return 'No Woven studio connected: ' + JSON.stringify(studio);
  const src = await (await fetch(BASE + '/export.luau')).text();
  const list = (xs) => `{${xs.map((i) => JSON.stringify(i)).join(',')}}`;
  const run = async (mode, opt = {}) => {
    let code = src.replace('local MODE = "list"', `local MODE = ${JSON.stringify(mode)}`);
    if (opt.only) code = code.replace('local ONLY = nil', `local ONLY = ${JSON.stringify(opt.only)}`);
    if (opt.ids) code = code.replace('local IDS = {}', `local IDS = ${list(opt.ids)}`);
    if (opt.names) code = code.replace('local NAMES = {}', `local NAMES = ${list(opt.names)}`);
    const r = await tools['roblox-studio'].execute_luau({ studio_id: sid, datamodel_type: 'Edit', code });
    if (typeof r === 'string') {
      try { return JSON.parse(r); } catch { throw new Error(`${mode} ${opt.only || ''}: ${r.slice(0, 300)}`); }
    }
    return r;
  };
  const post = async (route, data) => {
    const res = await fetch(BASE + route, { method: 'POST', body: JSON.stringify(data) });
    const text = await res.text();
    if (!res.ok) throw new Error(route + ': ' + text);
    return text;
  };
  const meta = await run('meta');
  await post('/meta', meta);
  const keys = await run('list');
  const images = new Set();
  const walk = (n) => {
    const m = typeof n.props?.Image === 'string' && n.props.Image.match(/(\d{5,})/);
    if (m) images.add(m[1]);
    (n.children || []).forEach(walk);
  };
  for (const key of keys) {
    const gui = await run('gui', { only: key });
    walk(gui);
    await post('/gui', gui);
  }
  for (const m of Object.values(meta.codeModules || {})) for (const id of m.source.matchAll(/rbxassetid:\/\/(\d+)/g)) images.add(id[1]);
  const ids = [...images];
  let sizeFailures = 0;
  const openable = [];
  for (let i = 0; i < ids.length; i += 20) {
    const sizes = await run('sizes', { ids: ids.slice(i, i + 20) });
    for (const [id, v] of Object.entries(sizes)) if (v.error) sizeFailures++; else openable.push([id, v[0], v[1]]);
    await post('/sizes', sizes);
  }
  // Images Studio can open (the group's own) are read pixel by pixel: their public thumbnail is a placeholder.
  // execute_luau results are cut at 100,000 characters, so each strip stays near 60 KB of raw pixels (80 KB base64).
  const pixelErrors = [];
  for (const [id, w, h] of openable) {
    const rows = Math.max(1, Math.floor(60000 / (4 * w)));
    for (let y0 = 0; y0 < h; y0 += rows) {
      const code = src.replace('local MODE = "list"', 'local MODE = "pixels"')
        .replace('local IDS = {}', `local IDS = ${list([id])}`)
        .replace('local ROW0 = 0', `local ROW0 = ${y0}`).replace('local ROWS = 128', `local ROWS = ${rows}`);
      const strip = await tools['roblox-studio'].execute_luau({ studio_id: sid, datamodel_type: 'Edit', code });
      if (typeof strip === 'string') { pixelErrors.push(`${id} row ${y0}: ${strip.slice(0, 120)}`); break; }
      if (strip.error) { pixelErrors.push(`${id}: ${strip.error}`); break; }
      await post('/pixels', strip);
    }
  }
  const names = await (await fetch(BASE + '/runtime-names')).json();
  await post('/runtime', await run('runtime', { names }));
  const merged = await (await fetch(BASE + '/done', { method: 'POST', body: '{}' })).text();
  return { guis: keys.length, images: ids.length, sizeFailures, studioPixelImages: openable.length, pixelErrors, runtimeNames: names.length, merged };
})()
