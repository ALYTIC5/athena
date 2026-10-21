import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createNodeRunner, createNodeSqlRunner } from '../src/lib/grader/node-client';
import { checkGrading } from './validator/checks/grading';
import { loadContent } from './validator/load';
import { formatIssues, readContentTexts, validateStatic } from './validator/run';

/**
 * `npm run validate`: schemas, references, coverage, time estimates and safety, then grading with the
 * same Pyodide and PGlite graders the browser uses. `--static` skips grading (fast).
 */
const staticOnly = process.argv.includes('--static');
/** `--only=py-02` grades just the files whose path contains that text; static checks still cover everything. */
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
const TRUTH = 'src/generated/predict-truth.json';

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
    const pick = <T extends { file: string }>(docs: T[]): T[] =>
      only ? docs.filter((d) => d.file.includes(only)) : docs;
    const scoped = {
      ...content,
      exercises: pick(content.exercises),
      quizzes: pick(content.quizzes),
      cards: pick(content.cards),
      lessons: pick(content.lessons),
      problems: pick(content.problems),
      drills: pick(content.drills),
    };
    const graded = await checkGrading(scoped, { py, pyAlt, sql });
    issues.push(...graded.issues);
    // The validator stores each predict item's output as its ground truth.
    // A scoped run only knows its own items, so merge into the existing file.
    const existing =
      only && existsSync(TRUTH)
        ? (JSON.parse(readFileSync(TRUTH, 'utf8')) as Record<string, string>)
        : {};
    mkdirSync('src/generated', { recursive: true });
    writeFileSync(TRUTH, JSON.stringify({ ...existing, ...graded.truth }, null, 2) + '\n');
  } finally {
    await Promise.all([py.dispose(), pyAlt.dispose(), sql.dispose()]);
  }
}

const errors = issues.filter((i) => i.severity === 'error');
if (issues.length > 0) process.stdout.write(formatIssues(issues) + '\n');
process.stdout.write(
  `validate: ${errors.length} error(s), ${issues.length - errors.length} warning(s)${staticOnly ? ' (static only)' : ''}${only ? ` (graded only: ${only})` : ''}\n`,
);
process.exit(errors.length > 0 ? 1 : 0);
