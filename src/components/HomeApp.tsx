import { useEffect, useMemo, useState } from 'react';
import { dueReattempts } from '../lib/gym/attempts';
import {
  COURSE_WEEKS,
  consistencyStreak,
  courseComplete,
  currentWeek,
  isoWeekKey,
  jobSearchTargets,
} from '../lib/schedule/week';
import {
  exportFileName,
  load,
  serialise,
  subscribe,
  toLocalDate,
  update,
  type LearnerData,
} from '../lib/store/store';
import { url } from '../lib/url';
import { useDueCount } from './DueBadge';

interface Week {
  week: number;
  lessons: { id: string; title: string; durationMin: number; status: 'planned' | 'published' }[];
  lab: { milestone: string; minutes: number }[];
  gym: { focus: string; target: number };
}

interface Curriculum {
  weeks: Week[];
  labPages: string[];
}

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}

const hoursText = (min: number) => `${Math.round((min / 60) * 100) / 100} h`;

export function HomeApp() {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [data, setData] = useState<LearnerData | null>(null);
  const [corrupt, setCorrupt] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const due = useDueCount();

  useEffect(() => {
    const read = () => {
      const s = load(window.localStorage);
      setCorrupt(s.status === 'corrupt');
      setData(s.status === 'ok' ? s.data : null);
    };
    read();
    fetch(url('data/curriculum.json'))
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load the course plan.');
        return (await r.json()) as Curriculum;
      })
      .then(setCurriculum)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the plan.'));
    return subscribe(window, read);
  }, []);

  const now = useMemo(() => new Date(), []);
  const today = toLocalDate(now);
  const weekKey = isoWeekKey(today);
  const startDate = data?.settings.startDate;

  if (error) return <p role="alert">{error}</p>;
  if (corrupt) {
    return (
      <p role="alert">
        Your saved data could not be read. Open <a href={url('settings/')}>Settings</a> to recover
        it.
      </p>
    );
  }
  if (!curriculum) return <p>Loading your dashboard…</p>;

  // ---- Setup steps until a start date exists ----------------------------------------------
  if (!startDate) {
    return (
      <section aria-label="Setup" data-testid="home-setup">
        <h2>Get set up</h2>
        <p>Three steps, about five minutes.</p>
        <ol>
          <li>
            Choose your start date in <a href={url('settings/')}>Settings</a>. It must be a Monday.
            Week 1 starts that day.
          </li>
          <li>
            Read <a href={url('start/')}>Start here</a>: how a lesson works, the think-aloud
            approach, the AI rule (Claude is your tutor, not your author) and how to back up your
            progress.
          </li>
          <li>
            Open the <a href={url('lessons/')}>first lesson</a> and start. Export your progress
            after your first session.
          </li>
        </ol>
      </section>
    );
  }

  const week = currentWeek(startDate, now);
  const hoursTarget = data?.settings.hoursPerWeek ?? 5;
  const log = data?.weeklyLog[weekKey];
  const streak = consistencyStreak(data?.weeklyLog ?? {}, hoursTarget, weekKey);
  const reattempts = data ? dueReattempts(data, now).length : 0;

  if (courseComplete(week)) {
    return (
      <section aria-label="Course complete" data-testid="home-complete">
        <h2>Course complete</h2>
        <p>
          You have reached the end of the 28 weeks. Your next steps: run the full mock loop again,
          keep reviewing your cards, and keep applying. Paste your exported progress into Claude
          Code for a weekly check-in whenever you want a plan for the next few weeks.
        </p>
        <ul>
          <li>
            <a href={url('gym/mock/')}>Mock interviews</a>
          </li>
          <li>
            <a href={url('competencies/')}>Check your competencies</a>
          </li>
          <li>
            <a href={url('review/')}>Review your cards</a>
          </li>
        </ul>
      </section>
    );
  }

  const plan = curriculum.weeks.find((w) => w.week === week);
  const mastered = (id: string) => {
    const status = data?.lessons[id]?.status;
    return status === 'mastered';
  };
  const upToNow = curriculum.weeks.filter((w) => w.week <= week).flatMap((w) => w.lessons);
  const resume = upToNow.find((l) => l.status === 'published' && !mastered(l.id));
  const targets = jobSearchTargets(week);
  const lessonMin = plan?.lessons.reduce((s, l) => s + l.durationMin, 0) ?? 0;
  const labMin = plan?.lab.reduce((s, l) => s + l.minutes, 0) ?? 0;

  const saveLog = (form: HTMLFormElement) => {
    const f = new FormData(form);
    const n = (k: string) => Math.max(0, Number(f.get(k) ?? 0));
    try {
      update(window.localStorage, new Date(), (d) => ({
        ...d,
        weeklyLog: {
          ...d.weeklyLog,
          [weekKey]: {
            updatedAt: new Date().toISOString(),
            hours: n('hours'),
            applications: n('applications'),
            pitches: n('pitches'),
            commitDays: Math.min(7, n('commitDays')),
          },
        },
      }));
      setMessage('Weekly log saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save the log.');
    }
  };

  const exportNow = () => {
    const s = load(window.localStorage);
    if (s.status !== 'ok') return;
    download(exportFileName(new Date()), serialise(s.data));
    try {
      update(window.localStorage, new Date(), (d) => ({
        ...d,
        settings: { ...d.settings, lastExportAt: new Date().toISOString() },
      }));
      setMessage('Progress exported.');
    } catch {
      setMessage('Exported, but the export date could not be saved.');
    }
  };

  return (
    <div data-testid="home">
      <h2 data-testid="week-heading">
        Week {week} of {COURSE_WEEKS}
      </h2>

      <section aria-label="This week">
        <h3>This week</h3>
        {plan ? (
          <>
            <p>
              About {hoursText(lessonMin + labMin)} of lessons and lab work, plus 15 minutes of
              review, one hour of Interview Gym and one hour of job search.
            </p>
            <ul data-testid="week-lessons">
              {plan.lessons.map((l) => (
                <li key={l.id}>
                  {l.status === 'published' ? (
                    <a href={url(`lessons/${l.id}/`)}>{l.title}</a>
                  ) : (
                    <>
                      {l.title} <em>(coming soon)</em>
                    </>
                  )}{' '}
                  ({hoursText(l.durationMin)}){mastered(l.id) ? ' · mastered' : ''}
                </li>
              ))}
              {plan.lessons.length === 0 && <li>No new lessons this week.</li>}
            </ul>
            {plan.lab.length > 0 && (
              <ul data-testid="week-lab">
                {plan.lab.map((m) => (
                  <li key={`${m.milestone}-${m.minutes}`}>
                    Lab milestone{' '}
                    {curriculum.labPages.includes(m.milestone) ? (
                      <a href={url(`labs/${m.milestone}/`)}>{m.milestone}</a>
                    ) : (
                      <>
                        <code>{m.milestone}</code> <em>(coming soon)</em>
                      </>
                    )}{' '}
                    ({m.minutes} min)
                  </li>
                ))}
              </ul>
            )}
            <p data-testid="week-gym">
              Interview Gym: <strong>{plan.gym.focus}</strong>
              {plan.gym.target > 0
                ? ` (${plan.gym.target} problem${plan.gym.target === 1 ? '' : 's'})`
                : ''}
              . Open the <a href={url('gym/')}>Gym</a>.
            </p>
            {targets && (
              <p data-testid="week-jobs">
                Job search: {targets.applications} and {targets.pitches}.
              </p>
            )}
          </>
        ) : (
          <p>No plan for this week.</p>
        )}
      </section>

      <section aria-label="Due now">
        <h3>Due now</h3>
        <ul>
          <li data-testid="due-reviews">
            <a href={url('review/')}>
              {due ?? 0} review card{due === 1 ? '' : 's'} due
            </a>
          </li>
          <li data-testid="due-reattempts">
            <a href={url('gym/')}>
              {reattempts} gym re-attempt{reattempts === 1 ? '' : 's'} due
            </a>
          </li>
        </ul>
      </section>

      <section aria-label="Current lesson">
        <h3>Current lesson</h3>
        {resume ? (
          <p data-testid="resume">
            <a href={url(`lessons/${resume.id}/`)}>Resume: {resume.title}</a>
          </p>
        ) : (
          <p data-testid="resume">
            No lesson to resume yet. New lessons appear here as they are published.
          </p>
        )}
      </section>

      <section aria-label="Weekly log">
        <h3>Weekly log</h3>
        <p data-testid="streak">
          Consistency streak: {streak} week{streak === 1 ? '' : 's'} at {hoursTarget} hours or more.
        </p>
        <form
          key={log?.updatedAt ?? 'new'}
          onSubmit={(e) => {
            e.preventDefault();
            saveLog(e.currentTarget);
          }}
        >
          <p>
            <label>
              Hours this week{' '}
              <input
                name="hours"
                type="number"
                min={0}
                step="0.25"
                defaultValue={log?.hours ?? 0}
              />
            </label>{' '}
            <label>
              Applications{' '}
              <input
                name="applications"
                type="number"
                min={0}
                defaultValue={log?.applications ?? 0}
              />
            </label>{' '}
            <label>
              Freelance pitches{' '}
              <input name="pitches" type="number" min={0} defaultValue={log?.pitches ?? 0} />
            </label>{' '}
            <label>
              Days with a commit{' '}
              <input
                name="commitDays"
                type="number"
                min={0}
                max={7}
                defaultValue={log?.commitDays ?? 0}
              />
            </label>
          </p>
          <p>
            <button type="submit">Save weekly log</button>{' '}
            <button type="button" onClick={exportNow}>
              Export progress
            </button>
          </p>
        </form>
        <p role="status" aria-live="polite" data-testid="home-status">
          {message}
        </p>
      </section>
    </div>
  );
}
