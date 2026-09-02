// Analyze a Metro source map: group bundled sources by top-level package and
// report total source text size + file count, sorted descending.
import { Buffer } from 'node:buffer';
import fs from 'node:fs';

const mapPath = process.argv[2];
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const groups = new Map();

for (let i = 0; i < map.sources.length; i++) {
  const src = map.sources[i];
  const content = (map.sourcesContent && map.sourcesContent[i]) || '';
  let key;
  const m = src.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  if (m) {
    key = m[1];
  } else {
    const rel = src.replace(/^.*?(\/app\/|\/components\/|\/services\/|\/hooks\/|\/features\/|\/constants\/|\/utils\/|\/assets\/|\/types\/)/, '$1');
    key = rel.startsWith('/') ? rel.split('/').slice(0, 3).join('/') : src;
  }
  if (!groups.has(key)) groups.set(key, { bytes: 0, files: 0 });
  const g = groups.get(key);
  g.bytes += Buffer.byteLength(content, 'utf8');
  g.files += 1;
}

const total = map.sources.reduce((sum, _, i) => sum + Buffer.byteLength(map.sourcesContent?.[i] || '', 'utf8'), 0);
const rows = [...groups.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
console.log(`TOTAL source text in map: ${(total / 1024 / 1024).toFixed(2)} MB across ${map.sources.length} files\n`);
for (const [key, g] of rows.slice(0, 45)) {
  console.log(`${(g.bytes / 1024 / 1024).toFixed(2).padStart(8)} MB  ${String(g.files).padStart(5)} files  ${key}`);
}
