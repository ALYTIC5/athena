import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const CDN = /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v314\.0\.7\/full\/(.+)$/;

interface Opt {
  text: string;
  correct: boolean;
}
interface Item {
  id: string;
  type: 'single' | 'multiple' | 'short' | 'predict' | 'parsons' | 'bug' | 'order';
  options?: Opt[];
  accepted?: string[];
  lines?: string[];
  buggyLine?: number;
  steps?: string[];
}

const items = new Map<string, Item>();
for (const f of ['sample', 'sample-2']) {
  const doc = parse(readFileSync(`src/content/quizzes/${f}.yaml`, 'utf8')) as { items: Item[] };
  for (const i of doc.items) items.set(i.id, i);
}
const truth = JSON.parse(readFileSync('src/generated/predict-truth.json', 'utf8')) as Record<
  string,
  string
>;

/** Serve Pyodide from disk so tests never depend on the CDN. */
async function serveFromDisk(page: Page) {
  const { existsSync } = await import('node:fs');
  const { readFile } = await import('node:fs/promises');
  await page.context().route(CDN, async (route) => {
    const name = CDN.exec(route.request().url())?.[1]?.split('?')[0] ?? '';
    for (const dir of ['node_modules/pyodide', '.pyodide-cache']) {
      const file = `${dir}/${name}`;
      if (existsSync(file)) {
        await route.fulfill({
          body: await readFile(file),
          headers: {
            'access-control-allow-origin': '*',
            'content-type': name.endsWith('.wasm')
              ? 'application/wasm'
              : name.endsWith('.json')
                ? 'application/json'
                : 'text/javascript',
          },
        });
        return;
      }
    }
    await route.continue();
  });
}

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
  });
}

async function setConfidence(q: Locator, label = 'Certain') {
  const radio = q.getByRole('radio', { name: label, exact: true });
  await radio.focus();
  await q.page().keyboard.press('Space');
}

async function arrange(q: Locator, list: Locator, target: string[]) {
  // Selection sort with the keyboard: pick up, ArrowUp to the target position, drop.
  for (let i = 0; i < target.length; i++) {
    const names = await list.locator('li > button:first-child').allTextContents();
    const from = names.indexOf(target[i] ?? '');
    if (from === i || from < 0) continue;
    const btn = list.locator('li > button:first-child').nth(from);
    await btn.focus();
    await q.page().keyboard.press('Space');
    for (let k = 0; k < from - i; k++) await q.page().keyboard.press('ArrowUp');
    await q.page().keyboard.press('Enter');
  }
}

/** Answer one question using only the keyboard. `right` false picks a wrong answer. */
async function answer(page: Page, id: string, right = true, scope?: Locator) {
  const item = items.get(id);
  if (!item) throw new Error(`unknown item ${id}`);
  const q = (scope ?? page).locator(`[data-question="${id}"]`);
  await q.scrollIntoViewIfNeeded();
  switch (item.type) {
    case 'single': {
      const opt = item.options?.find((o) => o.correct === right) as Opt;
      const r = q.getByRole('radio', { name: opt.text, exact: true });
      await r.focus();
      await page.keyboard.press('Space');
      break;
    }
    case 'multiple': {
      for (const o of item.options ?? []) {
        if (o.correct === right || (!right && o.correct)) {
          const c = q.getByRole('checkbox', { name: o.text, exact: true });
          await c.focus();
          if (right) await page.keyboard.press('Space');
        }
      }
      if (!right) {
        const first = q.getByRole('checkbox').first();
        await first.focus();
        await page.keyboard.press('Space');
      }
      break;
    }
    case 'short':
      await q.getByRole('textbox').fill(right ? (item.accepted?.[0] ?? '') : 'nonsense');
      break;
    case 'predict':
      await q.getByRole('textbox').fill(right ? (truth[id] ?? '') : 'wrong output');
      break;
    case 'bug': {
      const line = right ? (item.buggyLine ?? 1) : (item.buggyLine ?? 1) + 1;
      const r = q.getByRole('radio', { name: new RegExp(`^${line}:`) });
      await r.focus();
      await page.keyboard.press('Space');
      break;
    }
    case 'order': {
      const list = q.getByRole('list', { name: /Steps/ });
      const target = right ? (item.steps ?? []) : [...(item.steps ?? [])].reverse();
      await arrange(q, list, target);
      break;
    }
    case 'parsons': {
      const lines = item.lines ?? [];
      const order = right ? lines : [...lines].reverse();
      for (const l of order) {
        const add = q.getByRole('button', { name: `Add line: ${l.trim()}`, exact: true });
        await add.focus();
        await page.keyboard.press('Enter');
      }
      if (right) {
        const solution = q.getByRole('list', { name: 'Your solution' });
        for (let i = 0; i < lines.length; i++) {
          const indent = Math.floor((/^( *)/.exec(lines[i] ?? '')?.[1] ?? '').length / 4);
          if (indent === 0) continue;
          const btn = solution.locator('li > button:first-child').nth(i);
          await btn.focus();
          await page.keyboard.press('Space');
          for (let k = 0; k < indent; k++) await page.keyboard.press('Tab');
          await page.keyboard.press('Enter');
        }
      }
      break;
    }
  }
  await setConfidence(q);
  await q.getByRole('button', { name: 'Submit answer' }).focus();
  await page.keyboard.press('Enter');
  await expect(q.getByRole('button', { name: 'Submit answer' })).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await serveFromDisk(page);
});

test('quiz items: every question type can be answered with the keyboard only', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('samples/lesson/?seed=1');
  await scrollThrough(page);

  // Chunk 1 quick check plus a predict item and a Parsons item.
  await answer(page, 'sample-2-q-check-single');
  await expect(
    page.locator('[data-question="sample-2-q-check-single"] [data-testid="verdict"]'),
  ).toHaveAttribute('data-correct', 'true');
  await answer(page, 'sample-2-q-check-predict');
  const predict = page.locator('[data-question="sample-2-q-check-predict"]');
  await expect(predict.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
  await predict.getByRole('button', { name: 'Run it' }).click();
  await expect(predict.getByTestId('predict-output')).toContainText('ValueError', {
    timeout: 120000,
  });

  const parsonsScope = page.locator('section[aria-label="Question sample-q-parsons"]');
  await answer(page, 'sample-q-parsons', true, parsonsScope);
  await expect(parsonsScope.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');

  // Answers are recorded in the store with their confidence.
  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('athena') ?? '{}'),
  );
  expect(saved.answers['sample-2-q-check-single'].attempts[0]).toMatchObject({
    correct: true,
    confidence: 4,
    source: 'check',
  });
});

test('a wrong answer explains why', async ({ page }) => {
  await page.goto('samples/lesson/?seed=1');
  await scrollThrough(page);
  await answer(page, 'sample-2-q-check-single', false);
  const q = page.locator('[data-question="sample-2-q-check-single"]');
  await expect(q.getByTestId('verdict')).toHaveAttribute('data-correct', 'false');
  await expect(q).toContainText('A list scans items one by one');
});

test('warm-up draws five earlier items and records them as warm-up answers', async ({ page }) => {
  await page.goto('samples/lesson/?seed=2');
  await expect(page.getByRole('heading', { name: 'Warm-up', exact: true })).toBeVisible();
  const questions = page.locator('section[aria-labelledby="warmup-sample-2"] [data-question]');
  await expect(questions).toHaveCount(5);
  const ids = await questions.evaluateAll((els) => els.map((e) => e.getAttribute('data-question')));
  expect(ids.every((id) => id && !id.startsWith('sample-2-'))).toBe(true);
  await answer(
    page,
    ids[0] as string,
    true,
    page.locator('section[aria-labelledby="warmup-sample-2"]'),
  );
  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('athena') ?? '{}'),
  );
  expect(saved.answers[ids[0] as string].attempts[0].source).toBe('warmup');
  // Warm-up answers must not create or change review cards.
  expect(saved.cards).toEqual({});
});

test('checklist and rubric are stored; lab step shows coming soon; interview model answer unlocks', async ({
  page,
}) => {
  await page.goto('samples/lesson/');
  await scrollThrough(page);

  const checklist = page.locator('[data-practice="sample-2-checklist"]');
  await checklist.getByRole('checkbox').first().focus();
  await page.keyboard.press('Space');
  const rubric = page.locator('[data-practice="sample-2-rubric"]');
  await rubric.getByRole('radio', { name: /2: Clear in one sentence/ }).focus();
  await page.keyboard.press('Space');
  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('athena') ?? '{}'),
  );
  expect(saved.checklists['sample-2-checklist'].done).toEqual(['0']);
  expect(saved.rubrics['sample-2-rubric'].scores['Says what the project is']).toBe(2);

  await expect(page.getByText('The milestone page is coming soon.')).toBeVisible();

  const reveal = page.getByRole('button', { name: 'Show model answer' });
  await expect(reveal).toBeDisabled();
  await page
    .getByRole('region', { name: 'Interview corner' })
    .getByLabel('Your answer')
    .fill('Sets hash the value.');
  await reveal.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('model-answer')).toContainText('hash');
});

test('mastery check: pass needs 80% and an unaided make exercise; a fail routes to chunks and a retake differs', async ({
  page,
}) => {
  test.setTimeout(300000);
  await page.goto('samples/lesson/?seed=5');
  await scrollThrough(page);

  const mastery = page.locator('[data-mastery="sample-2"]');
  await mastery.getByTestId('start-mastery').focus();
  await page.keyboard.press('Enter');
  const first = mastery.locator('[data-question]');
  await expect(first).toHaveCount(4);
  const firstIds = await first.evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-question') as string),
  );
  await expect(mastery).toContainText('from earlier lessons');

  // Answer one question wrongly: 3 of 4 is 75%, below the 80% bar.
  for (const [i, id] of firstIds.entries()) await answer(page, id, i !== 0, mastery);
  await mastery.getByTestId('to-exercise').focus();
  await page.keyboard.press('Enter');

  // Pass the make exercise unaided so only the score fails the check.
  const ex = mastery.locator('[data-exercise]');
  await expect(ex).toBeVisible();
  const exId = (await ex.getAttribute('data-exercise')) as string;
  await ex.getByRole('button', { name: 'Edit code' }).click();
  await expect(ex.getByRole('textbox', { name: 'Python code editor' })).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(
    exId === 'sample-2-mastery-a'
      ? 'def double_all(numbers):\n    return [n * 2 for n in numbers]\n'
      : 'def distinct_callers(calls):\n    return len({c["caller"] for c in calls})\n',
  );
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex.getByTestId('exercise-status')).toHaveText('All checks pass.', {
    timeout: 120000,
  });
  await mastery.getByTestId('finish-mastery').focus();
  await page.keyboard.press('Enter');

  const result = mastery.getByTestId('mastery-result');
  await expect(result).toHaveAttribute('data-passed', 'false');
  await expect(result).toContainText('75%');
  let saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('athena') ?? '{}'));
  expect(saved.lessons['sample-2'].status).toBe('in-progress');
  expect(saved.lessons['sample-2'].masteryAttempts).toHaveLength(1);

  // Retake: different questions and a different make exercise.
  await result.getByRole('button', { name: 'Prepare a retake' }).click();
  await mastery.getByTestId('start-mastery').click();
  const second = mastery.locator('[data-question]');
  await expect(second).toHaveCount(4);
  const secondIds = await second.evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-question') as string),
  );
  expect(secondIds.filter((id) => firstIds.includes(id))).toEqual([]);
  for (const id of secondIds) await answer(page, id, true, mastery);
  await mastery.getByTestId('to-exercise').click();
  const ex2 = mastery.locator('[data-exercise]');
  const ex2Id = (await ex2.getAttribute('data-exercise')) as string;
  expect(ex2Id).not.toBe(exId);
  await ex2.getByRole('button', { name: 'Edit code' }).click();
  await expect(ex2.getByRole('textbox', { name: 'Python code editor' })).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(
    ex2Id === 'sample-2-mastery-a'
      ? 'def double_all(numbers):\n    return [n * 2 for n in numbers]\n'
      : 'def distinct_callers(calls):\n    return len({c["caller"] for c in calls})\n',
  );
  await ex2.getByRole('button', { name: 'Check' }).click();
  await expect(ex2.getByTestId('exercise-status')).toHaveText('All checks pass.', {
    timeout: 120000,
  });
  await mastery.getByTestId('finish-mastery').click();
  await expect(mastery.getByTestId('mastery-result')).toHaveAttribute('data-passed', 'true');
  saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('athena') ?? '{}'));
  expect(saved.lessons['sample-2'].status).toBe('mastered');
});

test('mastery check: passing the questions is not enough without an unaided exercise', async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.goto('samples/lesson/?seed=9');
  await scrollThrough(page);
  const mastery = page.locator('[data-mastery="sample-2"]');
  await mastery.getByTestId('start-mastery').click();
  const ids = await mastery
    .locator('[data-question]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-question') as string));
  for (const id of ids) await answer(page, id, true, mastery);
  await mastery.getByTestId('to-exercise').click();
  const ex = mastery.locator('[data-exercise]');
  await ex.getByRole('button', { name: 'Show hint' }).click();
  await mastery.getByTestId('finish-mastery').click();
  await expect(mastery.getByTestId('mastery-result')).toHaveAttribute('data-passed', 'false');
});

test('lesson page has no axe violations', async ({ page }) => {
  await page.goto('samples/lesson/?seed=1');
  await scrollThrough(page);
  await expect(page.getByRole('heading', { name: 'Mastery check' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
