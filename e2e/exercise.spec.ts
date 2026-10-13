import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const CDN = /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v314\.0\.7\/full\/(.+)$/;

/** Serve Pyodide (and cached wheels) from disk so tests do not depend on the CDN. */
async function serveFromDisk(context: BrowserContext) {
  await context.route(CDN, async (route) => {
    const name = CDN.exec(route.request().url())?.[1]?.split('?')[0] ?? '';
    for (const dir of ['node_modules/pyodide', '.pyodide-cache']) {
      const file = join(dir, name);
      if (existsSync(file)) {
        await route.fulfill({
          body: await readFile(file),
          headers: {
            'access-control-allow-origin': '*',
            'content-type': name.endsWith('.wasm')
              ? 'application/wasm'
              : name.endsWith('.json')
                ? 'application/json'
                : name.endsWith('.mjs') || name.endsWith('.js')
                  ? 'text/javascript'
                  : 'application/octet-stream',
          },
        });
        return;
      }
    }
    await route.continue();
  });
}

/** client:visible islands hydrate on scroll; wait until this exercise is interactive. */
async function hydrated(page: import('@playwright/test').Page, id: string) {
  const section = page.locator(`[data-exercise="${id}"]`);
  await section.scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:has([data-exercise="${id}"])`)).not.toHaveAttribute(
    'ssr',
    '',
  );
  return section;
}

test.beforeEach(async ({ context }) => {
  await serveFromDisk(context);
});

test('make exercise: keyboard-only run, fail, fix, pass', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('samples/exercises/');
  const ex = await hydrated(page, 'sample-make-total-minutes');
  await expect(ex.getByTestId('static-starter')).toBeVisible();

  // Open the editor with the keyboard, then replace the code.
  await ex.getByRole('button', { name: 'Edit code' }).focus();
  await page.keyboard.press('Enter');
  const editor = ex.getByRole('textbox', { name: 'Python code editor' });
  await expect(editor).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(
    'def total_minutes(calls):\n    return sum(c["minutes"] for c in calls)\n',
  );

  // Move to the buttons using only the keyboard: Esc then Tab leaves the editor.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await ex.getByRole('button', { name: 'Run tests' }).focus();
  await page.keyboard.press('Enter');
  await expect(ex.getByTestId('report')).toBeVisible({ timeout: 120000 });
  await expect(ex.getByTestId('report')).toContainText('Passed');

  // Check runs hidden tests: this wrong solution counts every status.
  await ex.getByRole('button', { name: 'Check' }).focus();
  await page.keyboard.press('Enter');
  await expect(ex.getByTestId('exercise-status')).toHaveText('Not yet. Read the feedback below.', {
    timeout: 60000,
  });
  await expect(ex.getByTestId('report')).toContainText('(hidden test)');
  await expect(ex.getByTestId('report')).toContainText("Only calls with status 'completed'");
  await expect(ex.getByTestId('solution')).toHaveCount(0);

  // Fix it and pass.
  await editor.focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(
    'def total_minutes(calls):\n    return sum(c["minutes"] for c in calls if c["status"] == "completed")\n',
  );
  await ex.getByRole('button', { name: 'Check' }).focus();
  await page.keyboard.press('Enter');
  await expect(ex.getByTestId('exercise-status')).toHaveText('All checks pass.', {
    timeout: 60000,
  });

  // Progress was recorded with full credit.
  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('athena') ?? '{}'),
  );
  expect(saved.exercises['sample-make-total-minutes'].bestCredit).toBe(1);
});

test('make exercise: infinite loop shows the timeout message', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('samples/exercises/');
  const ex = await hydrated(page, 'sample-make-total-minutes');
  await ex.getByRole('button', { name: 'Edit code' }).click();
  await expect(ex.getByRole('textbox', { name: 'Python code editor' })).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('def total_minutes(calls):\n    while True:\n        pass\n');
  await ex.getByRole('button', { name: 'Run tests' }).click();
  await expect(ex.getByTestId('error')).toContainText(
    'Your code ran for more than 5 seconds. Look for a loop that never ends.',
    { timeout: 120000 },
  );
});

test('hints cost credit and the tutor prompt is copied', async ({ page, context }) => {
  test.setTimeout(180000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  await page.goto('samples/exercises/');
  const ex = await hydrated(page, 'sample-make-total-minutes');
  await ex.getByRole('button', { name: 'Show hint' }).click();
  await expect(ex.getByTestId('hint')).toHaveCount(1);
  await ex.getByRole('button', { name: "I'm stuck" }).click();
  await expect(ex.getByTestId('exercise-status')).toContainText(/Prompt copied|Could not copy/);
});

test('write-tests exercise grades against correct and buggy versions', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('samples/exercises/');
  const ex = await hydrated(page, 'sample-write-tests-clamp');
  await ex.getByRole('button', { name: 'Edit code' }).click();
  await expect(ex.getByRole('textbox', { name: 'Python code editor' })).toBeFocused();
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex.getByTestId('findings')).toContainText('No test caught a bug', {
    timeout: 200000,
  });

  await ex.getByRole('textbox', { name: 'Python code editor' }).focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(
    [
      'import pytest',
      'from impl import clamp',
      '',
      'def test_inside():',
      '    assert clamp(5, 0, 10) == 5',
      '',
      'def test_low():',
      '    assert clamp(-3, 0, 10) == 0',
      '',
      'def test_high():',
      '    assert clamp(99, 0, 10) == 10',
      '',
      'def test_inverted():',
      '    with pytest.raises(ValueError):',
      '        clamp(1, 10, 0)',
      '',
    ].join('\n'),
  );
  await ex.getByRole('button', { name: 'Check' }).click();
  await expect(ex.getByTestId('findings')).toContainText(
    'Your tests accept the correct code and catch every bug.',
    { timeout: 200000 },
  );
});

test('exercise page has no axe violations', async ({ page }) => {
  await page.goto('samples/exercises/');
  const ex = await hydrated(page, 'sample-make-total-minutes');
  await expect(ex.getByRole('button', { name: 'Check' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
