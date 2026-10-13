import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  '',
  'start/',
  'lessons/',
  'review/',
  'gym/',
  'labs/',
  'competencies/',
  'settings/',
  'about/',
];

for (const p of pages) {
  test(`page /${p} loads with no axe violations`, async ({ page }) => {
    await page.goto(p);
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
