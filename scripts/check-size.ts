import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 150 * 1024;
const root = 'dist';
const base = '/athena/';
const pages = ['index.html', 'start/index.html', 'lessons/index.html', 'review/index.html'];

let worst = 0;
for (const page of pages) {
  const html = readFileSync(join(root, page), 'utf8');
  const refs = new Set(
    [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1] as string),
  );
  let total = 0;
  for (const ref of refs) {
    const file = join(root, ref.startsWith(base) ? ref.slice(base.length) : ref);
    if (existsSync(file)) total += gzipSync(readFileSync(file)).length;
  }
  process.stdout.write(`${page}: ${(total / 1024).toFixed(1)} KB gzip initial JS\n`);
  worst = Math.max(worst, total);
}
if (worst > BUDGET_BYTES) {
  process.stderr.write(`Over budget of ${BUDGET_BYTES / 1024} KB\n`);
  process.exit(1);
}
