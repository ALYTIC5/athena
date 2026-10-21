import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { hydrateAll, serveFromDisk, typeInEditor } from './helpers';

test.beforeEach(async ({ page }) => {
  await serveFromDisk(page);
});

test('py-01 renders in the documented order with chunk anchors and the make-exercise banner', async ({
  page,
}) => {
  await page.goto('lessons/py-01/');
  await hydrateAll(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Names, values and mutability');
  for (const n of [1, 2, 3]) await expect(page.locator(`#chunk-${n}`)).toBeVisible();

  const headings = await page.locator('main h2').allTextContents();
  const order = [
    'Why this matters',
    'Objectives',
    'Chunk 1',
    'Chunk 2',
    'Chunk 3',
    'Build a function that returns a filtered copy',
    'Find the bug',
    'Write it yourself',
    'Mastery check',
    'Interview corner',
    'Further reading',
  ];
  let at = -1;
  for (const want of order) {
    const i = headings.findIndex((h) => h.startsWith(want));
    expect(i, want).toBeGreaterThan(at);
    at = i;
  }

  // The banner is only on make exercises, not on the faded or debug ones.
  const make = page.locator('[data-exercise="py-01-make-reschedule"]');
  await expect(make).toContainText('Write this yourself. Claude can be your tutor');
  await expect(page.locator('[data-exercise="py-01-debug-shared-default"]')).not.toContainText(
    'Write this yourself',
  );
});

test('a faded exercise passes with the keyboard and records full credit', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('lessons/py-01/');
  await hydrateAll(page);
  const ex = page.locator('[data-exercise="py-01-faded-alias"]');
  await ex.getByRole('button', { name: 'Edit code' }).click();
  await typeInEditor(
    page,
    ex.getByRole('textbox', { name: 'Python code editor' }),
    'def same_list(first, second):\n    return first is second\n',
  );
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex.getByTestId('exercise-status')).toHaveText('All checks pass.', {
    timeout: 90000,
  });
  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('athena') ?? '{}'),
  );
  expect(saved.exercises['py-01-faded-alias'].bestCredit).toBe(1);
});

test('the warm-up is skipped while no earlier lesson supplies five items', async ({ page }) => {
  await page.goto('lessons/py-01/');
  await hydrateAll(page);
  await expect(page.getByRole('heading', { name: 'Warm-up', exact: true })).toHaveCount(0);
});

test('py-01 has no axe violations', async ({ page }) => {
  await page.goto('lessons/py-01/');
  await hydrateAll(page);
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
