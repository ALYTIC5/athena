import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('settings: save a start date, reload, export, import into a fresh context', async ({
  page,
  browser,
}) => {
  await page.goto('settings/');
  const startDate = page.getByLabel('Start date (a Monday)');
  await startDate.fill('2026-10-13'); // a Tuesday
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByTestId('status')).toHaveText('The start date must be a Monday.');

  await startDate.fill('2026-10-12');
  await page.getByLabel('Hours per week').fill('6');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByTestId('status')).toHaveText('Settings saved.');

  await page.reload();
  await expect(page.getByLabel('Start date (a Monday)')).toHaveValue('2026-10-12');
  await expect(page.getByLabel('Hours per week')).toHaveValue('6');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^athena-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  expect(JSON.parse(await readFile(path, 'utf8')).settings.startDate).toBe('2026-10-12');

  const fresh = await browser.newContext({ baseURL: 'http://localhost:4321/athena/' });
  const page2 = await fresh.newPage();
  await page2.goto('settings/');
  await expect(page2.getByLabel('Start date (a Monday)')).toHaveValue('');
  await page2.getByLabel('Replace current data').check();
  await page2.getByLabel('Choose a progress file').setInputFiles(path);
  await expect(page2.getByTestId('status')).toHaveText('Import complete (replace).');
  await expect(page2.getByLabel('Start date (a Monday)')).toHaveValue('2026-10-12');
  await fresh.close();
});

test('settings: a corrupt import is rejected and a corrupt store shows recovery', async ({
  page,
}) => {
  await page.goto('settings/');
  await page.getByLabel('Choose a progress file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":1}'),
  });
  await expect(page.getByTestId('status')).toContainText('Import failed');

  await page.evaluate(() => window.localStorage.setItem('athena', '{broken'));
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your saved data could not be read' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download raw data' })).toBeVisible();
});

test('settings page has no axe violations', async ({ page }) => {
  await page.goto('settings/');
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
