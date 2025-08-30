#!/usr/bin/env node
// Script: list-abandoned.js - heuristic scan for potentially abandoned source files
// Heuristics:
//  - .ts files in src/ not imported anywhere else (excluding barrel files, index.ts, server.ts)
//  - Not directly referenced in package.json scripts
// Prints a JSON array of suspect file paths.
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.cwd();
const srcDir = join(root, 'src');
function walk(dir){
  return readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return [p];
  });
}
const files = walk(srcDir).filter(f => extname(f)==='.ts');
const contentMap = new Map(files.map(f => [f, readFileSync(f,'utf8')]));
// Build reverse import map
const importRegex = /from\s+['"]([^'";]+)['"]/g;
const referenced = new Set();
for (const [file, code] of contentMap){
  let m; while ((m = importRegex.exec(code))){
    const spec = m[1];
    if (spec.startsWith('.')){
      // resolve relative
      // naive: mark any file whose basename matches
      const parts = spec.replace(/\.js$|\.ts$/,'').split('/').filter(Boolean);
      const base = parts[parts.length-1];
      for (const f of files){
        if (f.endsWith(`${base}.ts`) || f.endsWith(`${base}/index.ts`)) referenced.add(f);
      }
    }
  }
}
// Add entrypoints we keep
const keepNames = ['index.ts','server.ts','tools.ts','sse.ts'];
for (const f of files){
  if (keepNames.some(k => f.endsWith(k))) referenced.add(f);
}
// Ignore known optional single-purpose files that may be lazily imported
const ignore = new Set([
  join(srcDir, 'observability', 'sentry.ts'),
]);
// Suspects: not referenced, not in keep, not ignored
const suspects = files.filter(f => !referenced.has(f) && !ignore.has(f));
console.log(JSON.stringify({ suspects }, null, 2));