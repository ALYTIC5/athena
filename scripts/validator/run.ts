import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkCoverage } from './checks/coverage';
import { checkReferences } from './checks/references';
import { checkSafetyText, type TextFile } from './checks/safety';
import { checkSchemas } from './checks/schemas';
import { checkTime } from './checks/time';
import type { Content, Issue } from './types';

/** Every check that needs no interpreter: schemas, references, coverage, time and safety. */
export function validateStatic(content: Content, texts: TextFile[]): Issue[] {
  return [
    ...checkSchemas(content),
    ...checkReferences(content),
    ...checkCoverage(content),
    ...checkTime(content),
    ...checkSafetyText(texts),
  ];
}

function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, exts);
    return exts.some((e) => name.endsWith(e)) ? [path] : [];
  });
}

/** Text of every content file, for the safety scan. */
export function readContentTexts(): TextFile[] {
  return ['src/content', 'src/samples']
    .flatMap((dir) => walk(dir, ['.yaml', '.mdx']))
    .map((file) => ({ file: file.replace(/\\/g, '/'), text: readFileSync(file, 'utf8') }));
}

export function formatIssues(issues: Issue[]): string {
  return issues
    .map(
      (i) =>
        `${i.severity === 'error' ? 'ERROR  ' : 'warning'} [${i.rule}] ${i.where}: ${i.message}`,
    )
    .join('\n');
}
