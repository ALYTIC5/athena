import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { runPython } from '../src/lib/grader/grade';
import { createNodeRunner } from '../src/lib/grader/node-client';
import { expectedOutput } from '../src/lib/quiz/predict-truth';

/**
 * Build step: run every predict item with the Node grader and store its output as ground truth.
 * Authors never type expected output. The browser never computes answers.
 */
const QUIZ_DIR = 'src/content/quizzes';
const OUT = 'src/generated/predict-truth.json';

interface Item {
  id: string;
  type: string;
  code?: string;
}

const runner = createNodeRunner({ packageCacheDir: '.pyodide-cache' });
const truth: Record<string, string> = {};

try {
  for (const file of readdirSync(QUIZ_DIR).filter((f) => f.endsWith('.yaml'))) {
    const doc = parse(readFileSync(`${QUIZ_DIR}/${file}`, 'utf8')) as { items?: Item[] };
    for (const item of doc.items ?? []) {
      if (item.type !== 'predict' || typeof item.code !== 'string') continue;
      const r = await runPython(runner, item.code, [], 10000);
      if (r.timedOut) throw new Error(`Predict item ${item.id} timed out`);
      truth[item.id] = expectedOutput(r.stdout, r.error);
    }
  }

  // Predict cards: the card front is the code, and the back is shown after the learner answers.
  const CARD_DIR = 'src/content/cards';
  for (const file of readdirSync(CARD_DIR).filter((f) => f.endsWith('.yaml'))) {
    const doc = parse(readFileSync(`${CARD_DIR}/${file}`, 'utf8')) as {
      cards?: { id: string; type: string; front?: string }[];
    };
    for (const c of doc.cards ?? []) {
      if (c.type !== 'predict' || typeof c.front !== 'string') continue;
      const r = await runPython(runner, c.front, [], 10000);
      if (r.timedOut) throw new Error(`Predict card ${c.id} timed out`);
      truth[c.id] = expectedOutput(r.stdout, r.error);
    }
  }
} finally {
  await runner.dispose();
}

mkdirSync('src/generated', { recursive: true });
writeFileSync(OUT, JSON.stringify(truth, null, 2) + '\n');
process.stdout.write(`predict truth: ${Object.keys(truth).length} item(s)\n`);
