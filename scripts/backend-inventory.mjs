import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const entries = { tables: new Set(), functions: new Set(), rpc: new Set(), storage: new Set() };
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { await walk(filename); continue; }
    if (!/\.tsx?$/.test(filename) || filename.endsWith('types.ts')) continue;
    const source = await readFile(filename, 'utf8');
    const patterns = {
      tables: /(?<!storage)\.from\(\s*["']([^"']+)["']/g,
      functions: /(?:functions\.invoke|invokeServer(?:<[\s\S]*?>)?)\(\s*["']([^"']+)["']/g,
      rpc: /\.rpc\(\s*["']([^"']+)["']/g,
      storage: /storage\.from\(\s*["']([^"']+)["']/g,
    };
    for (const [key, regex] of Object.entries(patterns)) for (const match of source.matchAll(regex)) entries[key].add(match[1]);
  }
}
await walk('src');
await mkdir('docs', { recursive: true });
const result = Object.fromEntries(Object.entries(entries).map(([key, values]) => [key, [...values].sort()]));
await writeFile('docs/backend-inventory.json', JSON.stringify(result, null, 2) + '\n');
console.log(Object.fromEntries(Object.entries(result).map(([key, values]) => [key, values.length])));
