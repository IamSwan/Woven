// docs.mjs: reads the UI map (docs/client.md §5) so the kit labels screens with the documented owner and status.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function section5() {
  const md = fs.readFileSync(path.join(ROOT, 'docs', 'client.md'), 'utf8');
  const start = md.indexOf('## 5. UI map');
  if (start < 0) throw new Error('docs/client.md: "## 5. UI map" not found');
  const end = md.indexOf('\n## ', start + 5);
  return md.slice(start, end < 0 ? undefined : end);
}

const strip = (s) => s.replace(/\*\*/g, '').replace(/`/g, '').trim();

// Returns { byName: {gui: {owner, others, purpose, status, statusKind, settings}}, runtime: [{group, name, note}] }.
export function readUiMap() {
  const sec = section5();
  const byName = {};
  for (const line of sec.split(/\r?\n/)) {
    if (!line.startsWith('| ') || line.startsWith('| ScreenGui') || line.startsWith('|---')) continue;
    const cells = line.slice(1, -1).split(' | ').map((c) => c.trim());
    if (cells.length < 6) continue;
    const [names, settings, owner, others, purpose, status] = cells;
    const plain = strip(status);
    const statusKind = /legacy|dead|duplicate/i.test(plain) ? 'Legacy' : /warder mode/i.test(plain) ? 'Warder mode' : 'Live';
    for (const n of strip(names).replace(/\(.*?\)/g, '').split('/')) {
      const name = n.trim();
      if (name) byName[name] = { owner: strip(owner), others: strip(others), purpose: strip(purpose), status: plain, statusKind, settings: strip(settings) };
    }
  }
  const runtime = [];
  const list = sec.slice(sec.indexOf('Runtime-created guis'));
  for (const line of list.split(/\r?\n/)) {
    const m = line.match(/^- (.+?):\s(.*)$/);
    if (!m) continue;
    const group = strip(m[1]);
    // Each entry is `Name` optionally followed by a (note) before the next comma.
    for (const e of m[2].matchAll(/`([^`]+)`\s*(\([^)]*\))?/g)) {
      runtime.push({ group, name: e[1], note: e[2] ? strip(e[2].slice(1, -1)) : '' });
    }
  }
  return { byName, runtime };
}
