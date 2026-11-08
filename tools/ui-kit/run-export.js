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
  for (let i = 0; i < ids.length; i += 20) {
    const sizes = await run('sizes', { ids: ids.slice(i, i + 20) });
    sizeFailures += Object.values(sizes).filter((v) => v.error).length;
    await post('/sizes', sizes);
  }
  const names = await (await fetch(BASE + '/runtime-names')).json();
  await post('/runtime', await run('runtime', { names }));
  const merged = await (await fetch(BASE + '/done', { method: 'POST', body: '{}' })).text();
  return { guis: keys.length, images: ids.length, sizeFailures, runtimeNames: names.length, merged };
})()
