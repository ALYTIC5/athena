import { mkdirSync, writeFileSync } from 'node:fs';
import { createNodeRunner, createNodeSqlRunner } from '../src/lib/grader/node-client';
import { checkGrading } from './validator/checks/grading';
import { loadContent } from './validator/load';
import { formatIssues, readContentTexts, validateStatic } from './validator/run';

/**
 * `npm run validate`: schemas, references, coverage, time estimates and safety, then grading with the
 * same Pyodide and PGlite graders the browser uses. `--static` skips grading (fast).
 */
const staticOnly = process.argv.includes('--static');

const content = loadContent();
const issues = validateStatic(content, readContentTexts());

if (!staticOnly) {
  const cache = '.pyodide-cache';
  const py = createNodeRunner({ packageCacheDir: cache, env: { TZ: 'UTC', PYTHONHASHSEED: '0' } });
  const pyAlt = createNodeRunner({
    packageCacheDir: cache,
    env: { TZ: 'Pacific/Kiritimati', PYTHONHASHSEED: '1' },
  });
  const sql = createNodeSqlRunner();
  try {
    const graded = await checkGrading(content, { py, pyAlt, sql });
    issues.push(...graded.issues);
    // The validator stores each predict item's output as its ground truth.
    mkdirSync('src/generated', { recursive: true });
    writeFileSync('src/generated/predict-truth.json', JSON.stringify(graded.truth, null, 2) + '\n');
  } finally {
    await Promise.all([py.dispose(), pyAlt.dispose(), sql.dispose()]);
  }
}

const errors = issues.filter((i) => i.severity === 'error');
if (issues.length > 0) process.stdout.write(formatIssues(issues) + '\n');
process.stdout.write(
  `validate: ${errors.length} error(s), ${issues.length - errors.length} warning(s)${staticOnly ? ' (static only)' : ''}\n`,
);
process.exit(errors.length > 0 ? 1 : 0);
