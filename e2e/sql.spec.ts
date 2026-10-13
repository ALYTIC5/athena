import { expect, test, type Page } from '@playwright/test';

/** client:visible islands hydrate on scroll; wait until this exercise is interactive. */
async function hydrated(page: Page, id: string) {
  const section = page.locator(`[data-exercise="${id}"]`);
  await section.scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:has([data-exercise="${id}"])`)).not.toHaveAttribute(
    'ssr',
    '',
  );
  return section;
}

async function replaceCode(page: Page, section: ReturnType<Page['locator']>, code: string) {
  const editor = section.getByRole('textbox', { name: 'SQL code editor' });
  if (await editor.count()) await editor.focus();
  else await section.getByRole('button', { name: 'Edit code' }).click();
  await expect(editor).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(code);
}

test.describe('SQL exercises in the browser (PGlite)', () => {
  test.setTimeout(240000);

  test('left join: wrong answer is explained, right answer passes', async ({ page }) => {
    await page.goto('samples/exercises/');
    const ex = await hydrated(page, 'sample-sql-no-bookings');
    await expect(ex.getByRole('button', { name: 'Run tests' })).toBeHidden();

    await replaceCode(
      page,
      ex,
      'SELECT c.name FROM customers c JOIN bookings b ON b.customer_id = c.id ORDER BY c.name;',
    );
    await ex.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(ex.getByTestId('sql-result')).toContainText('Amara Okafor', { timeout: 180000 });

    await ex.getByRole('button', { name: 'Check' }).click();
    await expect(ex.getByTestId('mismatch')).toBeVisible({ timeout: 60000 });
    await expect(ex.getByTestId('exercise-status')).toHaveText('Not yet. Read the feedback below.');

    await replaceCode(
      page,
      ex,
      'SELECT c.name FROM customers c LEFT JOIN bookings b ON b.customer_id = c.id WHERE b.id IS NULL ORDER BY c.name;',
    );
    await ex.getByRole('button', { name: 'Check' }).click();
    await expect(ex.getByTestId('exercise-status')).toHaveText('All checks pass.', {
      timeout: 60000,
    });
  });

  test('pgvector: cosine distance nearest neighbours', async ({ page }) => {
    await page.goto('samples/exercises/');
    const ex = await hydrated(page, 'sample-sql-nearest-memory');
    await replaceCode(
      page,
      ex,
      "SELECT id FROM memories ORDER BY embedding <=> '[1, 0, 0]' LIMIT 2;",
    );
    await ex.getByRole('button', { name: 'Check' }).click();
    await expect(ex.getByTestId('exercise-status')).toHaveText('All checks pass.', {
      timeout: 180000,
    });
  });

  test('DDL: a duplicate booking must fail with 23505', async ({ page }) => {
    await page.goto('samples/exercises/');
    const ex = await hydrated(page, 'sample-sql-unique-booking');
    await replaceCode(
      page,
      ex,
      'CREATE TABLE bookings (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, room_id integer NOT NULL REFERENCES rooms(id), starts_at timestamptz NOT NULL, customer text NOT NULL);',
    );
    await ex.getByRole('button', { name: 'Check' }).click();
    await expect(ex.getByTestId('failures')).toContainText('Expected error 23505', {
      timeout: 180000,
    });

    await replaceCode(
      page,
      ex,
      'CREATE TABLE bookings (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, room_id integer NOT NULL REFERENCES rooms(id), starts_at timestamptz NOT NULL, customer text NOT NULL, UNIQUE (room_id, starts_at));',
    );
    await ex.getByRole('button', { name: 'Check' }).click();
    await expect(ex.getByTestId('exercise-status')).toHaveText('All checks pass.', {
      timeout: 60000,
    });
  });

  test('a runaway query is stopped with the timeout message', async ({ page }) => {
    await page.goto('samples/exercises/');
    const ex = await hydrated(page, 'sample-sql-no-bookings');
    await replaceCode(page, ex, 'SELECT count(*) FROM generate_series(1, 100000000000);');
    await ex.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(ex.getByTestId('error')).toContainText('Your code ran for more than 5 seconds', {
      timeout: 180000,
    });
  });
});
