import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { createDefault, type LearnerData } from '../src/lib/store/store';
import {
  copied,
  fakeClipboard,
  hydrateAll,
  saved,
  seedStore,
  serveFromDisk,
  stubClaude,
  typeInEditor,
} from './helpers';

interface Problem {
  id: string;
  referenceSolutions: { code: string }[];
  wrongSolutions: { code: string }[];
}
const problem = (name: string) =>
  parse(readFileSync(`src/content/problems/${name}.yaml`, 'utf8')) as Problem;
const REPEAT = problem('sample-gym-first-repeat');

const ID = 'sample-gym-first-repeat';

test.beforeEach(async ({ page }) => {
  await serveFromDisk(page);
  await stubClaude(page);
  await fakeClipboard(page);
});

test('timed problem: clock, think-aloud ticks, a wrong try, give up, pattern revealed, re-attempt scheduled', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto(`gym/problem/${ID}/?mode=timed`);
  await expect(page.getByTestId('clock')).toHaveText('Time left: 20:00');
  await expect(page.getByTestId('pattern')).toHaveCount(0);

  await page.getByTestId('start-timer').click();
  await expect(page.getByTestId('clock')).not.toHaveText('Time left: 20:00', { timeout: 5000 });

  await page.getByLabel('Clarify the problem').check();
  await page.getByLabel('Write the code').check();

  const editor = page.getByRole('textbox', { name: 'Python code editor' });
  await typeInEditor(page, editor, REPEAT.wrongSolutions[1]?.code ?? '');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByTestId('gym-status')).toHaveText('Not yet. Read the feedback below.', {
    timeout: 120000,
  });
  await expect(page.getByTestId('gym-result')).toHaveCount(0);

  await page.getByTestId('finish-attempt').click();
  const result = page.getByTestId('gym-result');
  await expect(result).toHaveAttribute('data-passed', 'false');
  await expect(page.getByTestId('pattern')).toHaveText('hashing');
  await expect(result).toContainText('re-attempt queue');

  const data = await saved(page);
  const rec = data.gym[ID];
  expect(rec.attempts).toHaveLength(1);
  expect(rec.attempts[0]).toMatchObject({
    mode: 'timed',
    passed: false,
    checklist: ['clarify', 'code'],
  });
  expect(rec.reattempt.reps).toBeGreaterThan(0);
});

test('a correct solution passes, rates communication and schedules no re-attempt', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto(`gym/problem/${ID}/?mode=approach`);
  await expect(page.getByTestId('clock')).toHaveCount(0);
  await typeInEditor(
    page,
    page.getByRole('textbox', { name: 'Python code editor' }),
    REPEAT.referenceSolutions[0]?.code ?? '',
  );
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByTestId('gym-result')).toHaveAttribute('data-passed', 'true', {
    timeout: 120000,
  });
  await page.getByLabel('4', { exact: true }).check();
  const data = await saved(page);
  expect(data.gym[ID].attempts[0]).toMatchObject({
    mode: 'approach',
    passed: true,
    communication: 4,
  });
  expect(data.gym[ID].reattempt).toBeUndefined();
});

test('time runs out: the notice appears and the attempt is not within the limit', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(`gym/problem/${ID}/?mode=timed`);
  await page.getByTestId('start-timer').click();
  await page.clock.fastForward(21 * 60 * 1000);
  await expect(page.getByTestId('time-up')).toBeVisible();
  await expect(page.getByTestId('clock')).toHaveText('Time left: 00:00');
});

test('gym hub: patterns listed, mixed set hides patterns, due re-attempts shown', async ({
  page,
}) => {
  const d: LearnerData = createDefault(new Date());
  d.gym[ID] = {
    updatedAt: new Date().toISOString(),
    attempts: [
      {
        at: new Date().toISOString(),
        mode: 'timed',
        passed: false,
        durationMs: 1,
        hintsUsed: 0,
        checklist: [],
      },
    ],
    reattempt: {
      due: new Date(Date.now() - 60_000).toISOString(),
      stability: 1,
      difficulty: 5,
      reps: 1,
      lapses: 1,
    },
  };
  await seedStore(page, JSON.stringify(d));
  await page.goto('gym/');
  const hub = page.getByTestId('gym-hub');
  await expect(hub).toContainText('hashing');
  await expect(hub).toContainText('two-pointers');
  await expect(page.getByTestId('reattempt-list')).toContainText('First repeated caller');

  await page.getByLabel('How many problems').selectOption('3');
  await page.getByTestId('make-mixed').click();
  const mixed = page.getByTestId('mixed-list');
  await expect(mixed.locator('li')).toHaveCount(3);
  const text = (await mixed.textContent()) ?? '';
  for (const pattern of ['hashing', 'two-pointers', 'intervals'])
    expect(text).not.toContain(pattern);
  // The mixed link opens in mixed mode and keeps the pattern hidden until the end.
  await mixed.locator('a').first().click();
  await expect(page.getByTestId('mode-text')).toContainText('pattern stays hidden');
  await expect(page.getByTestId('pattern')).toHaveCount(0);
});

test('code-reading drill: the bug fails, the fix passes, the explanation unlocks', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto('gym/drill/sample-drill-invoice/');
  await hydrateAll(page);
  await page.getByRole('button', { name: 'Run tests' }).click();
  await expect(page.getByTestId('drill-status')).toHaveText('Some tests still fail.', {
    timeout: 120000,
  });
  await expect(page.getByTestId('drill-report')).toContainText('test_sums_every_line');
  await expect(page.getByTestId('finish-pass')).toBeDisabled();

  const fixed = (
    parse(readFileSync('src/content/drills/sample-drill-invoice.yaml', 'utf8')) as {
      fixedFiles: Record<string, string>;
    }
  ).fixedFiles['invoice.py'] as string;
  await typeInEditor(page, page.getByRole('textbox', { name: 'invoice.py editor' }), fixed);
  await page.getByRole('button', { name: 'Run tests' }).click();
  await expect(page.getByTestId('drill-status')).toHaveText('All tests pass.', { timeout: 60000 });
  await page.getByTestId('finish-pass').click();
  await expect(page.getByTestId('drill-result')).toHaveAttribute('data-passed', 'true');
  await expect(page.getByTestId('drill-result')).toContainText('items[:-1]');
  const data = await saved(page);
  expect(data.drills['sample-drill-invoice'].attempts[0]).toMatchObject({
    passed: true,
    solutionViewed: false,
  });
});

test('AI-assisted drill: a hypothesis and a reflection are required', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('gym/drill/sample-drill-retry/');
  await hydrateAll(page);
  const fixed = (
    parse(readFileSync('src/content/drills/sample-drill-retry.yaml', 'utf8')) as {
      fixedFiles: Record<string, string>;
    }
  ).fixedFiles['retry.py'] as string;
  await typeInEditor(page, page.getByRole('textbox', { name: 'retry.py editor' }), fixed);
  await page.getByRole('button', { name: 'Run tests' }).click();
  await expect(page.getByTestId('drill-status')).toHaveText('All tests pass.', { timeout: 120000 });

  await page.getByTestId('finish-pass').click();
  await expect(page.getByTestId('drill-status')).toContainText('Record at least one hypothesis');

  await page.getByTestId('add-hypothesis').click();
  await expect(page.getByTestId('drill-status')).toContainText('Write your hypothesis first');
  await page
    .getByLabel('What do you think is wrong, and why?')
    .fill('range(1, tries) runs one try too few.');
  await page.getByTestId('add-hypothesis').click();
  await expect(page.getByTestId('hypothesis-count')).toContainText('1');

  await page.getByTestId('finish-pass').click();
  await expect(page.getByTestId('drill-status')).toContainText('Write a short reflection');
  await page.getByLabel(/Reflection/).fill('Asked about the off-by-one; confirmed with the tests.');
  await page.getByTestId('finish-pass').click();
  await expect(page.getByTestId('drill-result')).toHaveAttribute('data-passed', 'true');
  const data = await saved(page);
  expect(data.drills['sample-drill-retry'].attempts[0].reflection).toContain('range(1, tries)');
});

test('STAR stories are saved and the two-minute timer counts down', async ({ page }) => {
  await page.goto('gym/stories/');
  await page.getByLabel('Title').fill('The webhook that fired twice');
  await page.getByLabel('Situation').fill('A provider retried deliveries.');
  await page.getByRole('button', { name: 'Save story' }).click();
  await expect(page.getByTestId('star-status')).toContainText(
    'Saved: The webhook that fired twice',
  );
  const data = await saved(page);
  expect(data.stories).toHaveLength(1);
  expect(data.stories[0]).toMatchObject({
    id: 'story-1',
    situation: 'A provider retried deliveries.',
  });

  await expect(page.getByTestId('star-clock')).toHaveText('02:00');
  await page.getByTestId('star-start').click();
  await expect(page.getByTestId('star-clock')).not.toHaveText('02:00', { timeout: 5000 });
});

test('tutor prompt: opens Claude first, copies the real template, and caps credit', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('samples/exercises/');
  await hydrateAll(page);
  const ex = page.locator('[data-exercise="sample-make-total-minutes"]');
  const popup = page.waitForEvent('popup');
  await ex.getByRole('button', { name: "I'm stuck" }).click();
  expect((await popup).url()).toContain('claude.ai/new');
  await expect(ex.getByTestId('exercise-status')).toHaveText(
    'Prompt copied: paste it into Claude.',
  );
  const text = await copied(page);
  expect(text).toContain("You are my programming tutor. I'm learning:");
  expect(text).toContain('Write `total_minutes(calls)`');
  expect(text).toContain(
    'Rules: do not write the solution, and do not write more than one line of code at a time.',
  );
  expect(text).not.toContain('placeholder');
});

test('explain-back: prompt, session log, and a gap becomes a review card in one click', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('samples/lesson/');
  await hydrateAll(page);
  const section = page.locator('[data-explain="sample-make-total-minutes"]');
  await section.getByLabel('Your code or answer').fill('def total_minutes(calls): return 0');
  const popup = page.waitForEvent('popup');
  await section.getByTestId('copy-prompt').click();
  await popup;
  await expect(section.getByTestId('prompt-status')).toHaveText(
    'Prompt copied: paste it into Claude.',
  );
  const text = await copied(page);
  expect(text).toContain(
    "You are a strict but fair technical interviewer for a junior AI automation role. I'm practising.",
  );
  expect(text).toContain('def total_minutes(calls): return 0');

  const log = section.getByTestId('session-log');
  await log.getByLabel('Score for correctness (1 to 5)').selectOption('4');
  await log.getByLabel('Score for depth of understanding (1 to 5)').selectOption('3');
  await log.getByLabel('Score for clarity (1 to 5)').selectOption('5');
  await log.getByLabel('Gap 1').fill('Why does a generator expression save memory?');
  await log.getByRole('button', { name: 'Save session' }).click();
  await expect(log.getByTestId('session-status')).toHaveText('Session logged.');
  await log.getByRole('button', { name: 'Add as review card' }).click();
  const data = await saved(page);
  expect(data.sessions).toHaveLength(1);
  expect(data.sessions[0]).toMatchObject({ kind: 'explain', lessonId: 'sample' });
  const custom = Object.values(data.cards) as { custom?: { front: string } }[];
  expect(custom.map((c) => c.custom?.front)).toEqual([
    'Why does a generator expression save memory?',
  ]);
});

test('mock interviews: each round builds its prompt; the full loop has five rounds in order', async ({
  page,
}) => {
  await page.goto('gym/mock/');
  await page
    .getByLabel('Competencies to be asked about (comma separated)')
    .fill('py.sets, py.dicts');
  const popup = page.waitForEvent('popup');
  await page.getByTestId('copy-prompt').click();
  await popup;
  const text = await copied(page);
  expect(text).toBe(
    "Interview me for a junior AI automation role. Ask 8 questions about py.sets, py.dicts, one at a time, starting easy and getting harder. Don't teach during the round. At the end, score correctness, depth and clarity from 1 to 5 and list my three biggest gaps as questions.",
  );

  await page.getByLabel('Round').selectOption('full-loop');
  const rounds = await page
    .locator('[data-round]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-round')));
  expect(rounds).toEqual(['concept', 'live-coding', 'system-design', 'project', 'behavioural']);
});

test('gym pages have no axe violations', async ({ page }) => {
  for (const path of [
    'gym/',
    'gym/mock/',
    'gym/stories/',
    `gym/problem/${ID}/?mode=timed`,
    'gym/drill/sample-drill-invoice/',
    'gym/drill/sample-drill-retry/',
  ]) {
    await page.goto(path);
    await hydrateAll(page);
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, path).toEqual([]);
  }
});
