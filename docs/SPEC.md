# Athena: product and technical spec

## 1. Purpose

Athena teaches one learner, over 28 weeks at about 5 hours a week, to the level where they can pass interviews for junior roles in AI automation, backend Python and AI application engineering, and then do the job. It does this with lessons, auto-checked exercises, spaced review, interview practice and two project labs, all on a free static site.

Success means the learner reaches level 4 ("apply unaided") on every competency marked core in `docs/COMPETENCIES.md`, ships both lab projects in their own repos, and passes mock interviews at 4 out of 5 or better.

## 2. Constraints

- **Hosting:** GitHub Pages from the repo `ALYTIC5/athena`, served at `https://alytic5.github.io/athena/`. The repo starts private and is made public only after the learner checks that nothing private is tracked (free GitHub Pages needs a public repo).
- **No backend, no keys:** everything runs in the browser. No analytics, cookies or trackers.
- **One learner, one browser:** progress lives in localStorage and IndexedDB, with JSON export and import as the backup and the way to move between devices.
- **Time budget:** about 2.75 hours a week of lessons and lab work plus 15 minutes of review (two 1.5-hour sessions), 1 hour of Interview Gym and 1 hour of job search. Every page shows its time estimate.
- **AI policy for the learner:** during exercises, AI is a tutor only. The site never calls an AI API. It builds prompts the learner pastes into Claude.

## 3. Stack

Use the current stable version of each and record exact versions in `package.json`. Pin runtime CDN versions to the npm versions (see section 6).

- **Astro + Starlight** for pages, navigation, search (Starlight's built-in Pagefind) and dark mode. TypeScript in strict mode. Astro needs Node 22.12 or newer.
- **React islands** for interactive components, mounted through `.astro` wrapper components (section 5).
- **CodeMirror 6** editor with Python and SQL support, loaded on demand.
- **Pyodide** in a module Web Worker for Python, loaded from the jsDelivr CDN at a pinned version.
- **PGlite** in a Web Worker for PostgreSQL, with the pgvector extension (`@electric-sql/pglite-pgvector`, pinned to the version that matches PGlite exactly), bundled through npm and loaded on demand.
- **ts-fsrs** for spaced-repetition scheduling.
- **Zod** for content schemas at build time (`astro/zod`) and `zod/mini` in client code.
- **idb-keyval** (or similar) for code drafts in IndexedDB.
- **Vitest** with Testing Library for unit tests; **Playwright** with `@axe-core/playwright` for end-to-end and accessibility tests; **starlight-links-validator** for internal links.
- **ESLint** and **Prettier**; **gitleaks** (`gitleaks git --pre-commit --staged` in the hook, the gitleaks GitHub Action with `fetch-depth: 0` in CI) with `.gitleaks.toml` that extends the default rules and adds one regex allowlist for `ATHENA_FAKE` (use the syntax for the installed gitleaks version).

## 4. Repo layout

```
CLAUDE.md
README.md
.gitleaks.toml
docs/                         SPEC, TEACHING, CONTENT_GUIDE, CURRICULUM, COMPETENCIES, PROMPTS
private/                      LEARNER.md and anything personal (gitignored)
src/
  content.config.ts           collections: docs (Starlight) plus the YAML collections below
  content/
    docs/
      index.mdx               Home (dashboard)
      start.mdx, about.mdx, settings.mdx, review.mdx, competencies.mdx
      lessons/<lesson-id>.mdx one per lesson; order via sidebar.order
      gym/                    Interview Gym pages
      labs/                   lab and milestone pages
    exercises/<id>.yaml       one file per exercise; file name must equal id
    quizzes/<lesson-id>.yaml  question pools per lesson
    practice/<id>.yaml        checklists and rubrics
    cards/<lesson-id>.yaml    flashcards per lesson
    interview/<lesson-id>.yaml
    problems/<id>.yaml        Interview Gym problems
    drills/<id>.yaml          code-reading and AI-assisted drills
    curriculum.yaml           a list of week objects, each with an id
    competencies.yaml         a list of competency objects, each with an id
  components/                 .astro wrappers and React islands
  lib/
    grader/                   shared Python and SQL graders (browser and Node)
    runtime/                  worker clients for Pyodide and PGlite
    store/                    typed, versioned learner store, migrations, export/import
    srs/                      ts-fsrs wrapper and card schema
    prompts/                  Claude prompt builders (templates in section 11)
    schedule/                 week calculation and the this-week view
    competency/               level computation
    url.ts                    one base-aware url() helper used for every internal link
  workers/                    pyodide.worker.ts, pglite.worker.ts
  pages/data/                 build-time JSON endpoints (pools, hidden tests, solutions)
labs/
  webhook-agent/              CONTRACT.md, milestone specs, black-box acceptance tests, fixtures (no implementation)
  rag-evals/                  CONTRACT.md, milestone specs, acceptance tests, synthetic data (no implementation)
scripts/validate-content.ts
tests/                        unit tests; tests/lab_contract/ tests the lab suites against fakes
e2e/                          Playwright tests
.github/workflows/            ci.yml, deploy.yml
```

## 5. Pages and components

| Page | Purpose |
| --- | --- |
| Home (dashboard) | This week's plan, reviews due, current lesson, weekly log, streak, quick links |
| Start here | How Athena works, the think-aloud approach, the AI policy, backups and the Safari storage rule |
| Lessons | Lessons grouped by week and track, with status; planned lessons shown as "coming soon" |
| Lesson page | One lesson in the order set by `docs/TEACHING.md` |
| Review | Today's spaced-repetition session and a "practice more" mode |
| Interview Gym | Timed problems, mixed sets, re-attempts, drills, STAR stories, mock interview prompts |
| Labs | The two projects: contract, milestones, acceptance criteria, how to run the tests, evidence links |
| Competencies | Every competency with its computed level, self-rating and evidence |
| Settings | Start date, hours per week, job track, review caps, storage status, export, import, reset |
| About | What Athena is, how content is checked, and a note that hidden tests are hidden from the interface, not secret |

**Content components** (used in MDX): `WarmUp`, `Chunk` (renders the chunk heading with anchor `chunk-<n>` for remedial links), `Predict`, `Exercise`, `Parsons`, `Quiz`, `Callout`, `SessionBreak`, `ExplainBack`, `MasteryCheck`, `InterviewCorner`, `Checklist`, `Rubric`, `LabStep`. Usage is shown in `docs/CONTENT_GUIDE.md` section 3.

- Each is an `.astro` wrapper that takes ids, reads the content collections at build time, and renders a React island with `client:visible`. Make them available in MDX with astro-auto-import (or explicit imports in each file); a React component used without a `client:*` directive renders as static HTML and is silently not interactive.
- Island props carry only what the learner may see. Hidden tests and reference solutions are emitted as static JSON under `pages/data/` and fetched when the learner presses Check or unlocks the solution. Wrong solutions never leave the build. Question pools for warm-ups and mastery checks are fetched from build-time JSON, not passed as props.
- Exercise containers carry `data-pagefind-ignore` so search doesn't index tests or solutions.
- Until the learner focuses an editor or presses Run, show the starter code as static highlighted code; load CodeMirror and the runtime on demand.

**Routing:** `base: '/athena'` and `trailingSlash: 'always'`. Every internal link goes through the `url()` helper or Starlight's base-aware links; Markdown links are not prefixed with the base automatically. starlight-links-validator plus an end-to-end crawl check them.

## 6. Python runner

- Pyodide runs in a **module** Web Worker (`new Worker(url, { type: 'module' })`, importing `loadPyodide` from the pinned CDN's `pyodide.mjs`). Classic workers and `importScripts` are not supported in current Pyodide.
- One `PYODIDE_VERSION` constant builds the CDN URL. A unit test checks it equals the version of the `pyodide` npm package used by the validator.
- Start Pyodide with `env: { PYTHONHASHSEED: '0' }` so set and dict-of-set ordering is stable.
- It loads on first use (editor focus, Run or Check), with a progress indicator. One worker is shared per page.
- **Buttons:** Run (stdout and stderr), Run tests (visible tests), Check (all tests), Reset (restore starter after confirmation), and "I'm stuck" (tutor prompt, section 11).
- **Clean state per run:** before each run, remove from `sys.modules` every module not loaded at worker start, delete the previous run's files, call `importlib.invalidate_caches()`, and write multi-file drill files to a fresh directory. Use a fresh globals dictionary per run.
- **Timeout:** default 5 seconds per run (configurable per exercise). On timeout, terminate and recreate the worker and say: "Your code ran for more than {seconds} seconds. Look for a loop that never ends." (Interrupting with a SharedArrayBuffer is not possible on GitHub Pages, which can't send the required headers.)
- **Tracebacks:** show only frames from the learner's code, with line numbers matching the editor.
- **Environment rules for exercises:** never depend on the host time zone, the current time, threads, subprocesses, sockets or `input()`. Pass `now` and other inputs in as arguments. Exercises that use `zoneinfo` list `packages: [tzdata]`. Async exercises use top-level `await` through `runPythonAsync` (not `asyncio.run()`, which needs browser features not available everywhere).
- **Drafts:** the editor saves drafts to IndexedDB per exercise as the learner types (debounced).
- **One grader everywhere:** the validator runs the same grading code under Node with the `pyodide` npm package, inside `worker_threads` using the browser's message protocol and timeout path, with Node's `--experimental-wasm-jspi` flag, a cached `packageCacheDir` in CI, and every item run under both `TZ=UTC` and `TZ=Pacific/Kiritimati`.

## 7. Grading

### Python exercises

- Tests are plain Python functions named `test_*` that use `assert`. The grader discovers and runs them in order and reports each as passed, failed (with the assertion message) or errored (with the exception type and message).
- **Visible tests** are shown to the learner and run on Run tests. **Hidden tests** run only on Check and show only their name and the matching feedback message, never their code.
- **Feedback mapping:** an exercise can map a test name to a message that names the likely misconception.
- **Hint ladder:** three hints per exercise: a nudging question, then a strategy, then a near-solution with blanks. Each reveal is recorded. After about 15 minutes without a pass, the exercise suggests the first hint or the tutor prompt.
- **Credit:** passing with no hints earns 1.0; after hint 1, 0.75; after hint 2, 0.5; after hint 3, 0.25. If the tutor prompt was used, credit is capped at 0.75. Viewing the solution before passing earns 0. Only a 1.0 pass counts as "unaided".
- **Solution:** unlocked after a pass, or after three failed checks plus all hints. It is shown with its explanation and alternatives.

### Write-tests exercises

- The learner writes pytest tests (fixtures, `parametrize`, `pytest.raises` and `monkeypatch` allowed; `packages: [pytest]`).
- The exercise provides one correct implementation and several buggy ones. A pass means all of the learner's tests pass against the correct implementation and at least one test fails against each buggy implementation.

### SQL exercises

- Build a template database per exercise (extensions, schema, seed data). Run the reference query and the learner's query each on its own `await template.clone()`, and close every instance after use. Never rely on a wrapping transaction (a learner's `COMMIT` breaks it, and some statements can't run inside one).
- **Timeout:** the same rule as Python: terminate and recreate the worker (`worker_threads` under Node). PGlite does not enforce `statement_timeout`.
- Read results with `rowMode: 'array'` and the `fields` metadata so duplicate column names survive.
- Normalise before comparing: NUMERIC and BIGINT to numbers, dates and timestamps to ISO strings, vectors to text.
- Compare column names (case-insensitive, order must match) and rows (as a multiset unless `compare.orderMatters` is true, numbers within `compare.numericTolerance`, NULL equals NULL). DDL exercises use `compare: none` and rely on checks.
- **Checks** are extra assertions run after the learner's statement: either a query that must return a single `true`, or `{ sql, expectError: '23505' }` for a statement that must fail with that SQLSTATE (for example a duplicate booking).
- **Plan checks** (for index exercises) seed at least 10,000 rows, run `ANALYZE`, and accept Index Scan, Index Only Scan or Bitmap Index Scan.
- **Locking:** PGlite has a single connection, so concurrency can't be demonstrated in the browser. Queue-claim exercises are graded on their result plus structural checks: the statement contains `SKIP LOCKED`, `EXPLAIN` shows LockRows, and the claim is a single `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING ...`. Real concurrency is demonstrated in lab milestone wa-m3 against real PostgreSQL.
- PGlite runs a recent PostgreSQL (18 at the time of writing). Avoid features newer than what managed hosts commonly run (for example `uuidv7()`, `OLD`/`NEW` in `RETURNING`, virtual generated columns) unless a lesson flags them.

### Question types

- **Single and multiple choice:** every option has an explanation shown after answering. Distractors come from real misconceptions.
- **Short answer:** a list of accepted answers and optional regular expressions; case-insensitive and trimmed.
- **Predict the output:** the learner types the expected output. The ground truth is produced at build time by the validator (pinned Pyodide, `PYTHONHASHSEED=0`) and stored with the item; authors never type it. If the code raises, the expected answer is any printed output followed by the exception's type name on its own line (for example `TypeError`). Trailing whitespace is ignored. The learner can then press Run to see it execute, which loads Pyodide only on request.
- **Parsons problem:** scrambled lines, possibly with distractors and indentation. Graded on order and indentation. Keyboard alternative: Space picks up a line, the arrow keys move it, Tab and Shift+Tab change indentation only while a line is picked up, Enter drops it, and a live region announces each move.
- **Spot the bug:** choose the faulty line (keyboard selectable), optionally followed by a fix checked with tests.
- **Ordering:** put steps in order, keyboard accessible as above.
- **Checklist:** a list of steps the learner ticks off (for example, local setup steps). Self-assessed; never counts as unaided evidence.
- **Rubric:** the learner assesses their own work (for example a README or a design) against criteria, optionally after a Claude review. Self-assessed; never counts as unaided evidence.
- **Confidence:** for graded questions and predict items, the learner picks a confidence level before submitting: guessing, unsure, fairly sure or certain.

### Mastery check

- Each lesson has a mastery pool of at least twice as many questions as one check uses, plus at least two mastery make exercises that are different from the lesson's own make exercise.
- A check draws 8 to 12 questions (6 to 8 for short lessons, see `docs/TEACHING.md`) and one mastery make exercise. At least 30% of questions come from earlier published lessons once those supply 8 or more mastery items; before that, use what exists.
- Pass means 80% or more of the score, and the make exercise passed unaided. The lesson is then marked mastered and its cards are added to the review queue.
- On a fail, show which competencies were missed and link to the chunks tagged with them (each chunk has an anchor). A retake draws different questions and a different make exercise.
- The orientation lesson `start-00` has no warm-up, mastery check or cards.

## 8. Spaced repetition

- Use ts-fsrs with a desired retention of 0.9 and default parameters. Store cards in Athena's own schema with ISO date strings and convert to and from ts-fsrs objects at the boundary (ts-fsrs provides conversion helpers). Don't store fields the library has deprecated. Use a fixed clock in tests.
- **Card types:** basic (question and answer), cloze, predict (code with a build-time expected output) and explain (the learner answers, then grades themselves against a model answer).
- A lesson's cards are added when the lesson is mastered. Learner-made cards (for example gaps from a mock interview) can be added at any time.
- **Review session:** due cards in interleaved order across topics, ratings Again, Hard, Good and Easy. Keys 1 to 4 work only while the rating group has focus, and shortcuts can be switched off in Settings. Daily caps of 30 reviews and 10 new cards (configurable).
- The due count shows in the header and on Home.
- **Warm-up:** at the top of each full lesson, and of a short lesson that is first in its week, 5 items drawn from earlier lessons' question pools, weighted towards weak competencies. Warm-up answers are recorded as answers but don't change card schedules.
- **Gym re-attempts:** failed Interview Gym problems are scheduled with ts-fsrs in a separate queue shown in the Gym, outside the daily Review queue and its caps (built in phase 7).
- **Lapses:** a card has "recent lapses" if it was rated Again twice in the last 30 days. A mastered lesson becomes `needs-review` when 3 or more of its cards have recent lapses.

## 9. Interview Gym

- **Problems:** original problems tagged by pattern and difficulty. Each has a statement, examples, constraints, starter code, visible and hidden tests, reference solutions with time and space complexity, an explanation of the pattern, common mistakes and follow-up questions.
- **Modes:**
  - **Approach practice (untimed):** for the first weeks, simple problems with the think-aloud checklist and no clock.
  - **Timed solo:** 20 minutes for an easy problem, 40 for a medium. The weekly focus names the pattern.
  - **Mixed set:** one to three problems (the weekly focus says how many) with the pattern hidden until after the attempt.
  - **Re-attempt:** failed problems that are due.
- **Think-aloud checklist:** clarify, examples, brute force, optimise, code, test, complexity. The learner ticks each step as they do it out loud, and the ticks are logged.
- **Code-reading drills:** a multi-file program of 100 to 200 lines with a planted bug and a failing test, and a 30-minute limit.
- **AI-assisted drills:** a task where an AI assistant is allowed. The learner must write a hypothesis before each prompt and verify the output with tests, then log a short reflection.
- **STAR stories:** a builder for six stories (situation, task, action, result, what you learned) with a 2-minute delivery timer.
- **Mock interviews:** prompt builders for the round types in section 11, plus a form to log scores and gaps.

## 10. Labs

The learner writes both lab projects by hand in their own repos. Athena holds only contracts, specs and black-box acceptance tests, never an implementation.

- Each lab folder starts with `CONTRACT.md`, written before any test: every request and response body, status codes (including for duplicates), job status values, where ids live, environment variables, the fake-model script format, test-mode timing, how a failing job is forced, and the CLI contracts for milestones that aren't HTTP.
- `labs/<lab>/milestones/<id>.md` gives each milestone's goal, acceptance criteria, what to read and what done looks like.
- `labs/<lab>/acceptance/` holds pytest suites. HTTP milestones use httpx against `ATHENA_BASE_URL` and poll `GET /jobs/{id}` with a timeout rather than sleeping. Database milestones use `ATHENA_DATABASE_URL`. CLI milestones run the learner's command as defined in the contract. Every secret comes from environment variables.
- The suite refuses a non-localhost `ATHENA_BASE_URL` unless run with `-m smoke`. Smoke tests only send `ping` events, which never call a model.
- **Testing the suites without writing the service:** `tests/lab_contract/` (run by `npm run test:labs`) tests each suite against fakes with no real queue, worker, agent or retrieval logic: HTTP suites use table-driven fakes built on `httpx.MockTransport` that return canned responses for the fixture events; command-line suites use stub scripts that print canned JSON; the database check uses a small seeded fixture database. Each suite must also fail against at least three deliberately broken fakes. Lab A examples: no signature check; a duplicate event creates a second job; the injection transcript creates bookings. Lab B examples: search returns ids that aren't in the corpus; metrics ignore the seed and change between runs; an eval set with duplicate queries passes the schema check.
- Lab pages on the site show the contract, each milestone's checklist and acceptance criteria, how to run the suite, and an evidence field (a commit URL) stored in the learner store.

Milestones are listed in `docs/CURRICULUM.md`.

## 11. Claude prompt templates

The site builds these prompts and opens `https://claude.ai/new` in a new tab (call `window.open` first, then write to the clipboard, so popup blockers don't interfere), then shows "Prompt copied: paste it into Claude." Placeholders in braces are filled from the page. `{track}` is the job track chosen in Settings (for example "AI automation"). Use the wording exactly.

### Tutor ("I'm stuck")

```
You are my programming tutor. I'm learning: {lesson_title}.
Exercise: {exercise_prompt}
My code:
{code}
What happens when I run it:
{last_output_or_failing_test}
Rules: do not write the solution, and do not write more than one line of code at a time. Ask me one question that helps me find the problem myself. If I'm still stuck after two exchanges, explain the concept I'm missing with a different, small example.
```

### Explain-back

```
You are a strict but fair technical interviewer for a junior {track} role. I'm practising.
The objectives I'm working towards:
{objectives}
Here is my code or answer:
{code}
Rules:
- Ask me one question at a time and wait for my answer.
- Start by asking me to explain what my code does and why I made each choice.
- Push on why, edge cases, complexity, failure modes and alternatives.
- Don't give me the answer. If I'm stuck after two tries, give a small hint.
- After 8 to 10 questions, or when I say "score", stop and give:
  1. A score from 1 to 5 for correctness, depth of understanding and clarity.
  2. The three biggest gaps, each written as a short question I should be able to answer.
  3. One thing I did well.
```

### Mock interviews

- **Concept round:** "Interview me for a junior {track} role. Ask 8 questions about {competency_list}, one at a time, starting easy and getting harder. Don't teach during the round. At the end, score correctness, depth and clarity from 1 to 5 and list my three biggest gaps as questions."
- **Project deep-dive:** "Act as a sceptical senior engineer interviewing me about a project. Here is my summary: {project_summary}. Ask one question at a time about design decisions, trade-offs, failure modes, testing and what I'd change. Then score depth, honesty about limitations and clarity from 1 to 5 and list my three biggest gaps."
- **Behavioural:** "Ask me 5 behavioural questions typical for a junior developer, one at a time. After each answer, rate my STAR structure from 1 to 5 and say what was missing. Finish with my strongest and weakest story."
- **Live coding:** "Act as the interviewer for this problem: {problem_statement}. Let me ask clarifying questions first. Don't hint unless I ask. Evaluate how I communicate, my approach before coding, correctness, testing and complexity analysis, each from 1 to 5."
- **AI-assisted round:** "Act as an interviewer running an AI-assisted coding round. The task: {task}. I'll tell you what I'd ask my AI assistant and why, and how I'd check its output. Evaluate whether I stay in control, verify output and explain my reasoning, each from 1 to 5."
- **System design:** "Act as an interviewer running a 30-minute system design round for a junior {track} role. The problem: {design_problem}. Let me ask clarifying questions first, then ask one question at a time about components, data model, API, failure handling, scaling and trade-offs. Don't design it for me. At the end, score requirements, design, failure handling and communication from 1 to 5 and list my three biggest gaps as questions."
- **Full mock loop (week 28):** a concept round, a live-coding round, a system design round, a project deep-dive and a behavioural round, in that order, logged as five entries.

After any Claude session, the learner logs scores and gaps on the page. Each gap can become a review card in one click.

## 12. Data model

A single versioned JSON object in localStorage under the key `athena` (with a `version` field), with code drafts in IndexedDB. Validate with Zod on load, import and export. Migrations run in order from older versions.

```ts
type ISODate = string; // YYYY-MM-DD, a local calendar date
type ISOTime = string; // full ISO timestamp

interface Meta { updatedAt: ISOTime }

interface LearnerData {
  version: 1;
  settings: Meta & { startDate?: ISODate /* always a Monday */; hoursPerWeek: number; jobTrack: string;
              createdAt: ISOTime; lastExportAt?: ISOTime; reviewCaps: { reviews: number; newCards: number };
              shortcutsEnabled: boolean; persistentStorage?: boolean };
  lessons: Record<string, Meta & { status: 'not-started' | 'in-progress' | 'mastered' | 'needs-review';
              startedAt?: ISOTime; masteredAt?: ISOTime;
              masteryAttempts: { at: ISOTime; score: number; passed: boolean; missedCompetencies: string[] }[] }>;
  exercises: Record<string, Meta & { attempts: { at: ISOTime; passed: boolean; hintsUsed: 0 | 1 | 2 | 3;
              tutorUsed: boolean; solutionViewed: boolean; durationMs: number }[]; bestCredit: number }>;
  answers: Record<string, Meta & { attempts: { at: ISOTime; correct: boolean; confidence?: 1 | 2 | 3 | 4; source: 'check' | 'warmup' | 'mastery' }[] }>;
  cards: Record<string, Meta & { state: { due: ISOTime; stability: number; difficulty: number; reps: number;
              lapses: number; state: 'new' | 'learning' | 'review' | 'relearning'; lastReview?: ISOTime };
              custom?: { front: string; back: string; competencies: string[] } }>;
  reviewLog: { cardId: string; at: ISOTime; rating: 1 | 2 | 3 | 4 }[];
  gym: Record<string, Meta & { attempts: { at: ISOTime; mode: 'approach' | 'timed' | 'mixed' | 'reattempt'; passed: boolean;
              durationMs: number; hintsUsed: number; checklist: string[]; communication?: 1 | 2 | 3 | 4 | 5 }[];
              reattempt?: { due: ISOTime; stability: number; difficulty: number; reps: number; lapses: number } }>;
  drills: Record<string, Meta & { attempts: { at: ISOTime; passed: boolean; durationMs: number; hintsUsed: number;
              solutionViewed: boolean; reflection?: string }[] }>;
  sessions: { id: string; at: ISOTime; kind: 'explain' | 'concept' | 'project' | 'behavioural' | 'live-coding' | 'ai-assisted' | 'system-design';
              lessonId?: string; exerciseId?: string; competencies: string[];
              scores: Record<string, 1 | 2 | 3 | 4 | 5>; gaps: string[]; notes?: string }[];
  stories: (Meta & { id: string; title: string; situation: string; task: string; action: string; result: string; learned: string })[];
  checklists: Record<string, Meta & { done: string[] }>;
  rubrics: Record<string, Meta & { scores: Record<string, number>; notes?: string }>;
  labs: Record<string, Meta & { done: boolean; evidenceUrl?: string; at?: ISOTime }>;
  weeklyLog: Record<string /* ISO week, e.g. 2026-W43 */, Meta & { hours: number; applications: number; pitches: number; commitDays: number }>;
  selfRatings: Record<string /* competency id */, Meta & { level: 0 | 1 | 2 | 3 | 4 | 5 }>;
}
```

- **Writes** are read-modify-write against the current localStorage value, and the app listens for `storage` events so two open tabs don't overwrite each other.
- **Export** downloads `athena-progress-YYYY-MM-DD.json`. Offer one-click export after every mastery check and weekly log entry. **Import** validates first, then offers "replace" or "merge" (merge takes the union of attempt lists and the record with the later `updatedAt`).
- **Storage safety:** call `navigator.storage.persist()` on first run and show the result in Settings. Show a banner after 7 days without an export: Safari deletes all script-writable site storage after seven days of browser use without a visit to the site. Start here explains this and recommends Chrome or Firefox, or adding the site to the Home Screen or Dock.
- Corrupt data must never crash the site: show a recovery screen that offers to download the raw data and reset.

## 13. Schedule and dashboard

- **Week number:** whole weeks between `startDate` (always a Monday) and today, computed on local calendar dates (not milliseconds, so daylight-saving changes don't shift weeks), plus 1, minimum 1. If the learner falls behind, they move the start date in Settings. After week 28 Home shows a "course complete" view with next steps.
- Before a start date is set, Home shows the setup steps.
- **This week** (from `curriculum.yaml`): the lessons (published or "coming soon"), the gym focus and target, the lab milestone, and the job-search targets (1 to 3 applications and 1 or 2 freelance pitches).
- Also on Home: reviews due, gym re-attempts due, the current lesson with a resume link, the weekly log form, and a consistency streak (weeks in a row that met the hours target).
- **Competencies page:** each competency with its computed level, the learner's self-rating beside it, the evidence behind the level, a "rusty" flag, and an "overconfident" list (questions answered "certain" but wrong in the last 30 days).

### Competency level rules (highest rule met)

For competencies taught through browser exercises:

- **0 Not started**
- **1 Recognise:** at least 2 tagged questions answered correctly.
- **2 Explain:** an explain-back session on tagged work with depth and clarity of 3 or more, or an explain card for it rated Good or Easy twice.
- **3 Apply with help:** a tagged exercise passed (hints allowed).
- **4 Apply unaided:** a tagged make exercise passed unaided and the lesson's mastery check passed.
- **5 Debug and teach:** a tagged debug exercise or code-reading drill passed unaided, and an explain-back session with all scores 4 or more.

For interview competencies (`int.*`):

- **3:** one tagged gym problem passed. **4:** two tagged problems passed unaided within the time limit, on different days. **5:** also a tagged code-reading drill passed unaided.
- For `int.code-reading` and `int.ai-assisted`, count drills instead of problems. For `int.ai-assisted`, AI use is allowed by design, and "unaided" means the bug explanation or solution was not viewed.

For competencies shown by local work (Git, Docker, cloud, FastAPI, CI, communication, system design and similar, marked `evidence: local` in `competencies.yaml`):

- **4:** the lesson's mastery check passed, plus the linked lab milestone or checklist done with an evidence URL. **5:** also an explain-back or mock session on it with all scores 4 or more.

**Rusty flag:** shown if the competency's cards are overdue by more than 14 days or have recent lapses (section 8). The level does not drop.

## 14. Non-functional requirements

- **Performance:** at most 150 KB of JavaScript (gzipped) on initial page load. CodeMirror, Pyodide, PGlite and the workers load on demand and are excluded from this budget. A size check on `dist/` and Lighthouse CI run in CI. Lighthouse mobile scores of at least 85 for performance and 95 for accessibility on Home, a lesson and Review.
- **Accessibility:** WCAG 2.2 AA. axe finds no violations on any page type. Every flow can be completed with the keyboard alone. Where the editor captures Tab, show "Press Esc, then Tab, to leave the editor" (CodeMirror's tab-focus behaviour).
- **Browsers:** current Chrome, Firefox, Safari and Edge. Reading, quizzes and review must work well on a 390-pixel-wide phone; coding is optimised for desktop.
- **Privacy:** no requests other than the pinned runtime assets. No cookies.
- **Resilience:** if a runtime fails to load, show a clear message and keep the rest of the lesson usable.

## 15. Testing and CI

- **Unit (Vitest):** graders, scoring and credit, mastery selection, SRS scheduling with a fixed clock, store migrations and merge, week calculation (including across a daylight-saving change), competency levels, prompt builders, and the `PYODIDE_VERSION` check.
- **End-to-end (Playwright):** a full lesson, an exercise pass and fail, a Parsons problem using only the keyboard, a review session, a gym problem with the timer, export and import, and axe on every page type. Serve Pyodide from `node_modules` with `page.route` so tests don't depend on the CDN. Run the PGlite sample against `astro preview`.
- **Content (`npm run validate`):** see `docs/CONTENT_GUIDE.md` section 8.
- **CI (`ci.yml`)** runs on every push and pull request: install, `npm run check:full`, gitleaks, and a step that fails if `git ls-files` lists anything under `private/` or matching `*progress*.json`.
- **Deploy (`deploy.yml`)** runs only after CI succeeds on `main` (a `workflow_run` trigger or a job with `needs:`): build with the official Astro action and publish with the official Pages deploy action. Pages source: GitHub Actions.
