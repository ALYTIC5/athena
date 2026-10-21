import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { hydrateAll, saved } from './helpers';

test('labs hub lists both labs and every milestone, with no progress at first', async ({
  page,
}) => {
  await page.goto('labs/');
  const labs = page.getByTestId('labs');
  await expect(labs.getByRole('link', { name: /Lab A: webhook-to-agent service/ })).toBeVisible();
  await expect(
    labs.getByRole('link', { name: /Lab B: memory retrieval with evals/ }),
  ).toBeVisible();
  await expect(labs.locator('li[data-milestone]')).toHaveCount(12);
  await expect(labs.locator('li[data-milestone="wa-m2"]')).toContainText('Not done');
  await expect(labs.locator('li[data-milestone="re-m1"]')).toContainText('Weeks 21, 22');
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test('a lab page links its contract, and the contract page renders', async ({ page }) => {
  await page.goto('labs/webhook-agent/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/webhook-to-agent/);
  await expect(page.locator('li[data-milestone]')).toHaveCount(7);
  await page.getByRole('link', { name: 'Read the contract' }).click();
  await expect(page).toHaveURL(/labs\/webhook-agent\/contract\/$/);
  await expect(
    page.getByRole('heading', { name: 'Signature', exact: false }).first(),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test('milestone checklist: tick items with the keyboard, then reload and see them kept', async ({
  page,
}) => {
  await page.goto('labs/wa-m2/');
  await hydrateAll(page);
  const panel = page.locator('[data-lab-panel="wa-m2"]');
  await expect(panel).toContainText('0 of');
  const boxes = page.locator('#lab-body input[type="checkbox"]');
  const count = await boxes.count();
  expect(count).toBeGreaterThan(3);
  await expect(boxes.first()).toBeEnabled();
  await expect(boxes.first()).toHaveAttribute('aria-label', /\w/);
  await boxes.first().focus();
  await page.keyboard.press('Space');
  await boxes.nth(2).check();
  await expect(panel).toContainText(`2 of ${count} checks ticked`);
  expect((await saved(page)).checklists['lab-wa-m2'].done).toEqual(['0', '2']);

  await page.reload();
  await hydrateAll(page);
  await expect(boxes.first()).toBeChecked();
  await expect(boxes.nth(1)).not.toBeChecked();
  await expect(boxes.nth(2)).toBeChecked();

  await boxes.first().uncheck();
  expect((await saved(page)).checklists['lab-wa-m2'].done).toEqual(['2']);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test('evidence: a milestone cannot be marked done without a valid https link', async ({ page }) => {
  await page.goto('labs/wa-m2/');
  await hydrateAll(page);
  const status = page.getByTestId('lab-status');
  const done = page.getByLabel('I have finished this milestone');

  await done.click();
  await expect(status).toHaveText('Save an evidence link before you mark this milestone done.');
  await expect(done).not.toBeChecked();

  const evidence = page.getByLabel(/Evidence link/);
  await evidence.fill('http://insecure.example.com/x');
  await page.getByRole('button', { name: 'Save evidence' }).click();
  await expect(status).toHaveText('The link must start with https://.');

  await evidence.fill('https://github.com/someone/lab-a/commit/abc123');
  await page.getByRole('button', { name: 'Save evidence' }).click();
  await expect(status).toHaveText('Evidence link saved.');
  await done.check();
  await expect(status).toHaveText('Milestone marked done.');

  const stored = (await saved(page)).labs['wa-m2'];
  expect(stored.done).toBe(true);
  expect(stored.evidenceUrl).toBe('https://github.com/someone/lab-a/commit/abc123');

  await page.goto('labs/');
  const row = page.locator('li[data-milestone="wa-m2"]');
  await expect(row).toContainText('Done');
  await expect(row.getByRole('link', { name: 'evidence link' })).toHaveAttribute(
    'href',
    'https://github.com/someone/lab-a/commit/abc123',
  );
});

test('every milestone page of both labs renders its body and the progress panel', async ({
  page,
}) => {
  for (const id of ['wa-m1', 'wa-m7', 're-m1', 're-m5']) {
    await page.goto(`labs/${id}/`);
    await hydrateAll(page);
    await expect(page.locator('#lab-body')).toContainText('Evidence');
    await expect(page.locator(`[data-lab-panel="${id}"]`)).toBeVisible();
  }
});
