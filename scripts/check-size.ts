import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Initial-load JavaScript budget (docs/SPEC.md §14): at most 150 KB gzipped per page. Counts the
 * scripts a page references, plus the entry modules of islands that hydrate immediately
 * (`client:load`) and everything those modules import statically. Lazy islands, workers,
 * CodeMirror, Pyodide and PGlite are loaded on demand and are excluded.
 */
const BUDGET_BYTES = 150 * 1024;
const root = 'dist';
const base = '/athena/';
const pages = ['index.html', 'start/index.html', 'lessons/index.html', 'review/index.html'];

const toFile = (ref: string) =>
  join(root, ref.startsWith(base) ? ref.slice(base.length) : ref.replace(/^\//, ''));

function staticImports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(
    /(?:^|[;}\s,])(?:import|export)\s*(?:[^"'()]*?\sfrom\s*)?["'](\.{1,2}\/[^"']+)["']/g,
  )) {
    out.push(normalize(join(dirname(file), m[1] as string)));
  }
  return out;
}

function closure(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const f = stack.pop() as string;
    if (seen.has(f) || !existsSync(f) || !f.endsWith('.js')) continue;
    seen.add(f);
    stack.push(...staticImports(f));
  }
  return seen;
}

let worst = 0;
for (const page of pages) {
  const html = readFileSync(join(root, page), 'utf8');
  const entries = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="([^"]+\.js)"/g)) entries.add(toFile(m[1] as string));
  for (const island of html.matchAll(/<astro-island\b[^>]*>/g)) {
    const tag = island[0];
    if (!/client="load"/.test(tag)) continue;
    for (const attr of ['component-url', 'renderer-url']) {
      const m = new RegExp(`${attr}="([^"]+)"`).exec(tag);
      if (m) entries.add(toFile(m[1] as string));
    }
  }
  const files = closure([...entries]);
  let total = 0;
  for (const f of files) total += gzipSync(readFileSync(f)).length;
  process.stdout.write(
    `${page}: ${(total / 1024).toFixed(1)} KB gzip initial JS (${files.size} files)\n`,
  );
  worst = Math.max(worst, total);
}
if (worst > BUDGET_BYTES) {
  process.stderr.write(`Over budget of ${BUDGET_BYTES / 1024} KB\n`);
  process.exit(1);
}
