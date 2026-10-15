import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createDefault, type LearnerData } from '../src/lib/store/store';
import { saved, seedStore } from './helpers';

function store(mutate: (d: LearnerData) => void = () => undefined): string {
  const d = createDefault(new Date('2026-10-01T09:00:00'));
  mutate(d);
  return JSON.stringify(d);
}

/** Fix "now" to local noon on a calendar date, so the week calculation is repeatable. */
async function today(page: Page, date: string) {
  await page.clock.setFixedTime(new Date(`${date}T12:00:00`));
}

test('before a start date: three setup steps and no week', async ({ page }) => {
  await page.goto('./');
  const setup = page.getByTestId('home-setup');
  await expect(setup).toBeVisible();
  await expect(setup.locator('li')).toHaveCount(3);
  await expect(setup.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(page.getByTestId('week-heading')).toHaveCount(0);
});

test('this week comes from the curriculum: published lessons link, planned ones say coming soon', async ({
  page,
}) => {
  await seedStore(
    page,
    store((d) => (d.settings.startDate = '2026-10-12')),
  );
  await today(page, '2026-10-14');
  await page.goto('./');
  await expect(page.getByTestId('week-heading')).toHaveText('Week 1 of 28');
  const lessons = page.getByTestId('week-lessons');
  await expect(lessons).toContainText('How Athena works');
  await expect(lessons).toContainText('(coming soon)');
  await expect(page.getByTestId('week-gym')).toContainText('Think-aloud approach');
  // Job search starts in week 2.
  await expect(page.getByTestId('week-jobs')).toHaveCount(0);
});

test('week 2 adds the job-search targets and the week-9 lab milestone shows coming soon', async ({
  page,
}) => {
  await seedStore(
    page,
    store((d) => (d.settings.startDate = '2026-10-12')),
  );
  await today(page, '2026-10-19');
  await page.goto('./');
  await expect(page.getByTestId('week-heading')).toHaveText('Week 2 of 28');
  await expect(page.getByTestId('week-jobs')).toContainText('1 to 3 tailored applications');
  await expect(page.getByTestId('week-jobs')).toContainText('1 or 2 freelance pitches');

  await seedStore(page, store());
  await today(page, '2026-12-07');
  await page.goto('./');
  await expect(page.getByTestId('week-heading')).toHaveText('Week 9 of 28');
  await expect(page.getByTestId('week-lab')).toContainText('wa-m1');
  await expect(page.getByTestId('week-lab')).toContainText('(coming soon)');
});

test('the week does not shift across a daylight-saving change', async ({ page }) => {
  await seedStore(
    page,
    store((d) => (d.settings.startDate = '2026-03-23')),
  );
  await today(page, '2026-03-29');
  await page.goto('./');
  await expect(page.getByTestId('week-heading')).toHaveText('Week 1 of 28');
  await today(page, '2026-03-30');
  await page.reload();
  await expect(page.getByTestId('week-heading')).toHaveText('Week 2 of 28');
});

test('after week 28 the course complete view replaces the plan', async ({ page }) => {
  await seedStore(
    page,
    store((d) => (d.settings.startDate = '2026-01-05')),
  );
  await today(page, '2026-10-01');
  await page.goto('./');
  await expect(page.getByTestId('home-complete')).toContainText('Course complete');
  await expect(page.getByTestId('week-heading')).toHaveCount(0);
});

test('weekly log saves under the ISO week, the streak counts weeks, export downloads', async ({
  page,
}) => {
  await seedStore(
    page,
    store((d) => {
      d.settings.startDate = '2026-10-12';
      for (const key of ['2026-W41', '2026-W42']) {
        d.weeklyLog[key] = {
          updatedAt: new Date().toISOString(),
          hours: 5,
          applications: 1,
          pitches: 1,
          commitDays: 3,
        };
      }
    }),
  );
  await today(page, '2026-10-21');
  await page.goto('./');
  await expect(page.getByTestId('streak')).toContainText('2 weeks');

  await page.getByLabel('Hours this week').fill('6');
  await page.getByLabel('Applications').fill('2');
  await page.getByRole('button', { name: 'Save weekly log' }).click();
  await expect(page.getByTestId('home-status')).toHaveText('Weekly log saved.');
  const data = await saved(page);
  expect(data.weeklyLog['2026-W43']).toMatchObject({ hours: 6, applications: 2 });
  await expect(page.getByTestId('streak')).toContainText('3 weeks');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  expect((await download).suggestedFilename()).toBe('athena-progress-2026-10-21.json');
});

test('due re-attempts show on Home', async ({ page }) => {
  await seedStore(
    page,
    store((d) => {
      d.settings.startDate = '2026-10-12';
      d.gym['sample-gym-first-repeat'] = {
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
    }),
  );
  await page.goto('./');
  await expect(page.getByTestId('due-reattempts')).toContainText('1 gym re-attempt due');
});

test('the competencies page computes levels from evidence and lists overconfident answers', async ({
  page,
}) => {
  const day = 86_400_000;
  await seedStore(
    page,
    store((d) => {
      const at = new Date(Date.now() - 2 * day).toISOString();
      for (const id of ['sample-q-single', 'sample-q-single-c']) {
        d.answers[id] = { updatedAt: at, attempts: [{ at, correct: true, source: 'check' }] };
      }
      d.answers['sample-q-short'] = {
        updatedAt: at,
        attempts: [{ at, correct: false, confidence: 4, source: 'check' }],
      };
    }),
  );
  await page.goto('competencies/');
  const row = page.locator('[data-competency="py.values-names"]');
  await expect(row).toHaveAttribute('data-level', '1');
  await expect(row).toContainText('Recognise');
  await expect(row).toContainText('2 tagged questions answered correctly.');
  await expect(page.getByTestId('overconfident-list')).toContainText('py.values-names');
  // A competency with no evidence stays at 0.
  await expect(page.locator('[data-competency="sec.secrets"]')).toHaveAttribute('data-level', '0');

  await row.getByRole('combobox').selectOption('4');
  await expect(row).toContainText('Your rating is above the evidence.');
  const data = await saved(page);
  expect(data.selfRatings['py.values-names'].level).toBe(4);
});

test('Home and Competencies have no axe violations', async ({ page }) => {
  await seedStore(
    page,
    store((d) => (d.settings.startDate = '2026-10-12')),
  );
  await today(page, '2026-10-19');
  for (const path of ['./', 'competencies/']) {
    await page.goto(path);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, path).toEqual([]);
  }
});
