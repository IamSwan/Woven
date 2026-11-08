// receive.mjs: localhost sink for the UI kit export. Serves export.luau and the runtime gui names to the
// MCP Code Mode runner (tools/ui-kit/run-export.js) and saves what it posts, so the JSON never passes through
// an agent's context. Listens on 127.0.0.1 only. POST /done merges everything into docs/ui-kit/data/ui.json and exits.
// Usage: node tools/ui-kit/receive.mjs [port]   (default 47821)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readUiMap } from './docs.mjs';

const here = path.join(ROOT, 'tools', 'ui-kit');
const dataDir = path.join(ROOT, 'docs', 'ui-kit', 'data');
const port = Number(process.argv[2] || 47821);
const got = { meta: null, sizes: {}, runtime: {}, guis: {} };

function merge() {
  const keys = Object.keys(got.guis);
  if (!got.meta || keys.length === 0) throw new Error('nothing to merge (need meta and at least one gui)');
  const out = { ...got.meta, imageSizes: got.sizes, runtimeOwners: got.runtime, guis: keys.map((k) => got.guis[k]) };
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'ui.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  return `${path.relative(ROOT, file)}: ${keys.length} guis, ${Object.keys(got.sizes).length} image sizes, ${Object.keys(got.runtime).length} runtime names`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET') {
    if (url.pathname === '/export.luau') {
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      return res.end(fs.readFileSync(path.join(here, 'export.luau'), 'utf8'));
    }
    if (url.pathname === '/runtime-names') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify([...new Set(readUiMap().runtime.map((r) => r.name))]));
    }
    res.statusCode = 404;
    return res.end();
  }
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try {
      const body = Buffer.concat(chunks).toString('utf8');
      if (url.pathname === '/done') {
        const msg = merge();
        console.log(msg);
        res.end(msg);
        server.close();
        return;
      }
      const data = JSON.parse(body);
      if (url.pathname === '/meta') got.meta = data;
      else if (url.pathname === '/sizes') Object.assign(got.sizes, data);
      else if (url.pathname === '/runtime') Object.assign(got.runtime, data);
      else if (url.pathname === '/gui') {
        if (typeof data.key !== 'string') throw new Error('gui chunk without key');
        got.guis[data.key] = data;
      } else { res.statusCode = 404; return res.end('unknown'); }
      console.log('got', url.pathname, body.length);
      res.end('ok');
    } catch (e) {
      res.statusCode = 400;
      res.end(String(e.message || e));
    }
  });
});
server.listen(port, '127.0.0.1', () => console.log('listening on 127.0.0.1:' + port));
