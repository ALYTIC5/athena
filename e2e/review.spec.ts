import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createDefault, type LearnerData } from '../src/lib/store/store';

const truth = JSON.parse(readFileSync('src/generated/predict-truth.json', 'utf8')) as Record<
  string,
  string
>;

function seed(mutate: (d: LearnerData) => void = () => undefined): string {
  const d = createDefault(new Date());
  for (const lesson of ['sample', 'sample-2']) {
    d.lessons[lesson] = {
      updatedAt: new Date().toISOString(),
      status: 'mastered',
      masteryAttempts: [],
    };
  }
  mutate(d);
  return JSON.stringify(d);
}

async function withStore(page: Page, json: string) {
  await page.addInitScript((value) => {
    if (!window.localStorage.getItem('athena')) window.localStorage.setItem('athena', value);
  }, json);
}

async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('athena') ?? '{}'));
}

async function waitForReview(page: Page) {
  await expect(page.getByText('Loading your review session…')).toHaveCount(0);
}

/** Reveal the card, answer when the type asks for it, then rate with the number key. */
async function reviewCard(page: Page, key: string) {
  const card = page.locator('[data-card]');
  const id = (await card.getAttribute('data-card')) as string;
  const type = await card.getAttribute('data-type');
  if (type === 'predict') await card.getByRole('textbox').fill(truth[id] ?? '');
  if (type === 'explain') await card.getByRole('textbox').fill('Because it is shared.');
  const show = card.getByTestId('show-answer');
  await show.focus();
  await page.keyboard.press('Enter');
  const group = card.getByTestId('rating-group');
  await expect(group).toBeVisible();
  // Focus moves to the rating group; the number key rates only while it has focus.
  await expect(group.locator('button[data-rating="3"]')).toBeFocused();
  await page.keyboard.press(key);
  return { id, type };
}

test('nothing to review before any lesson is mastered; the badge says 0', async ({ page }) => {
  await page.goto('review/');
  await waitForReview(page);
  await expect(page.getByTestId('review-empty')).toContainText('Nothing to review');
  await expect(page.getByTestId('due-badge')).toHaveText('Review: 0 due');
});

test('a full session with the keyboard: interleaved topics, every card type, ratings saved', async ({
  page,
}) => {
  await withStore(page, seed());
  await page.goto('review/');
  await waitForReview(page);
  await expect(page.getByTestId('due-badge')).toHaveText('Review: 5 due');
  await expect(page.getByTestId('review-status')).toContainText('5 cards left');

  const order: string[] = [];
  const types = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const { id, type } = await reviewCard(page, '4');
    order.push(id);
    types.add(type ?? '');
  }
  // Round-robin across lessons: the second card comes from the other lesson.
  expect(order[0]?.startsWith('sample-c-')).toBe(true);
  expect(order[1]).toBe('sample-2-c-set');
  expect(types).toEqual(new Set(['basic', 'cloze', 'predict', 'explain']));

  await expect(page.getByTestId('review-empty')).toContainText('Session complete');
  const data = await saved(page);
  expect(data.reviewLog).toHaveLength(5);
  expect(Object.keys(data.cards)).toHaveLength(5);
  expect(
    Object.values(data.cards).every(
      (c) => (c as { state: { state: string } }).state.state === 'review',
    ),
  ).toBe(true);
  await expect(page.getByTestId('due-badge')).toHaveText('Review: 0 due');
});

test('number keys do nothing when shortcuts are switched off', async ({ page }) => {
  await withStore(
    page,
    seed((d) => {
      d.settings.shortcutsEnabled = false;
    }),
  );
  await page.goto('review/');
  await waitForReview(page);
  const card = page.locator('[data-card]');
  await card.getByTestId('show-answer').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('3');
  expect((await saved(page)).reviewLog).toHaveLength(0);
  await page.getByRole('button', { name: /^Good/ }).click();
  await expect.poll(async () => (await saved(page)).reviewLog.length).toBe(1);
});

test('daily caps limit new cards', async ({ page }) => {
  await withStore(
    page,
    seed((d) => {
      d.settings.reviewCaps = { reviews: 30, newCards: 2 };
    }),
  );
  await page.goto('review/');
  await waitForReview(page);
  await expect(page.getByTestId('review-status')).toContainText('2 cards left');
  await expect(page.getByTestId('due-badge')).toHaveText('Review: 2 due');
});

test('a card rated Again returns in the same session', async ({ page }) => {
  await withStore(page, seed());
  await page.goto('review/');
  await waitForReview(page);
  const first = await reviewCard(page, '1');
  const remaining = page.getByTestId('review-status');
  await expect(remaining).toContainText('5 cards left');
  const data = await saved(page);
  expect(data.cards[first.id].state.state).toBe('learning');
});

test('practice mode shows rated cards without changing schedules', async ({ page }) => {
  await withStore(page, seed());
  await page.goto('review/');
  await waitForReview(page);
  for (let i = 0; i < 5; i++) await reviewCard(page, '4');
  const before = await saved(page);
  await page.getByRole('button', { name: /Practice more/ }).click();
  await expect(page.getByTestId('review-status')).toContainText('practice mode, no scheduling');
  const card = page.locator('[data-card]');
  await card.getByTestId('show-answer').focus();
  await page.keyboard.press('Enter');
  await card.getByTestId('next-practice').click();
  const after = await saved(page);
  expect(after.reviewLog).toEqual(before.reviewLog);
  expect(after.cards).toEqual(before.cards);
});

test('learner-made cards can be added and reviewed', async ({ page }) => {
  await withStore(page, createDefault(new Date()) && JSON.stringify(createDefault(new Date())));
  await page.goto('review/');
  await waitForReview(page);
  await page.getByLabel('Front').fill('What does idempotent mean?');
  await page.getByLabel('Back').fill('Repeating the call has the same effect as one call.');
  await page.getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByTestId('review-status')).toContainText('Card added');
  await expect(page.locator('[data-card]')).toContainText('your card');
});

test('review page has no axe violations', async ({ page }) => {
  await withStore(page, seed());
  await page.goto('review/');
  await waitForReview(page);
  await page.locator('[data-card]').getByTestId('show-answer').click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
