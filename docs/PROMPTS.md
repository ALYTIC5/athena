# Build prompts

Paste these into Claude Code one at a time, from the repo folder.

- **One phase per session.** Start each phase in a fresh session so the context is clean; `CLAUDE.md` makes every session re-read the specs. If a session runs long, Claude commits, summarises in the pull request and stops; start a new session with "Continue phase X from git log and the open pull request."
- **Review before merging.** Each phase ends with a pull request. Check it (CI green, the summary's lists of what was checked and what's uncertain, and for lessons the checklist in docs/CONTENT_GUIDE.md section 9), then merge. Every merge to `main` deploys the site. If a phase goes wrong, close the pull request without merging, or `git revert` the merge.
- **Time:** reviewing and merging takes about 30 to 60 minutes a week, outside your study hours.

## When each phase must be ready

| Phases | What | Ready by |
| --- | --- | --- |
| 0 to 9b | Platform, validator and the golden lesson py-01 | Before week 1 |
| 10a to 10d | Lessons for weeks 1 and 2, Start here and About | Before week 1 |
| 12a | Gym: approach practice and hashing problems | Before week 1 |
| 13 | Quality pass and launch | Before week 1 |
| 11a to 11h | Lessons for weeks 4 to 8 | Each by the week before it's taught: py-02 by week 3, py-03 by week 4, then two a week in weeks 5 to 7 |
| 12b, 12c | Gym: remaining easy problems and the first drills | Week 5 |
| 14a, 14c | Lab A and the Labs pages | Week 8 |
| 15a to 15e | Lessons for weeks 9 to 11 | Week 8 |
| 17 | Gym: later patterns, medium problems and more drills | Week 10 |
| 16a to 16e | Lessons for weeks 14 to 19 | Week 13 |
| 14b | Lab B | Week 20 |
| 18a to 18f | Lessons for weeks 21 to 26 | Week 20 |
| 19a to 19c | Lessons for weeks 27 and 28 | Week 26 |

---

## Phase 0: kickoff (no code)

```
Read CLAUDE.md, every file in docs/, and private/LEARNER.md. Don't write any code or create any files yet.

1. Summarise what we're building in 10 lines so I can confirm you've understood it.
2. List anything in the docs that is ambiguous, contradictory or risky, with your recommended decision for each.
3. Check the current stable versions of Node.js, Astro, Starlight, @astrojs/react, CodeMirror 6, Pyodide (and the Python version it ships), PGlite and @electric-sql/pglite-pgvector, ts-fsrs, Zod, Vitest, Playwright and gitleaks, using their official docs or npm. Note anything that changes docs/SPEC.md.
4. Check my setup: `node --version` (needs 22.12 or newer), `git --version`, `gh auth status` (I need the workflow scope; if it's missing, tell me to run `gh auth refresh -s workflow`), and whether gitleaks is installed.
5. Confirm the phases in docs/PROMPTS.md and each phase's definition of done.

Then wait for my go-ahead.
```

## Phase 1: scaffold, CI and a live site

```
Phase 1: scaffold and deploy. Follow docs/SPEC.md sections 3, 4, 5, 14 and 15.

- Set `git config user.email` to my GitHub noreply address (ask me for it) before the first commit.
- Scaffold Astro + Starlight in this folder: TypeScript strict, React integration, ESLint and Prettier, Vitest with Testing Library, Playwright with @axe-core/playwright, starlight-links-validator. Keep the kit's .gitignore and merge any scaffold entries into it; never replace it.
- Configure site and base (`/athena`) with trailingSlash 'always', and create the url() helper in src/lib/url.ts.
- Add .gitleaks.toml (extend the default rules, plus one regex allowlist for ATHENA_FAKE, using the syntax of the installed gitleaks version) and a pre-commit hook running `gitleaks git --pre-commit --staged`.
- Add the npm scripts listed in CLAUDE.md, including check and check:full, and a size-budget script for dist/. `validate` can be a stub for now.
- Add .github/workflows/ci.yml (check:full, gitleaks with fetch-depth 0, and a step that fails if `git ls-files` lists anything under private/ or matching *progress*.json) and deploy.yml (runs only after CI succeeds on main; official Astro action, then the official Pages deploy action).
- Create placeholder pages for every page in SPEC section 5.
- Before the first commit, run `git check-ignore -v private/LEARNER.md progress.json athena-progress-2026-01-01.json .env` and stop if any of them is not ignored.
- Create the repo as PRIVATE: `gh repo create ALYTIC5/athena --private --source . --push`. Show me the output of `git ls-files` and wait for my OK.
- After my OK: `gh repo edit ALYTIC5/athena --visibility public --accept-visibility-change-consequences`, enable GitHub Pages with GitHub Actions as the source (use `gh api` if possible, otherwise tell me the exact clicks), and confirm the site is live.

Done when `npm run check:full` passes, CI is green and the site is live. Give me the URL, then stop.
```

## Phase 2: learner data and content foundations

```
Phase 2: the learner store and the content foundations. Follow docs/SPEC.md sections 4, 12 and 13, and docs/CONTENT_GUIDE.md sections 1 and 2.

1. Content foundations: Zod schemas (astro/zod) for every collection in docs/CONTENT_GUIDE.md section 1, with the lesson fields added to Starlight's docs schema as optional fields. Create src/content/curriculum.yaml from docs/CURRICULUM.md (every lesson with status: planned) and src/content/competencies.yaml from docs/COMPETENCIES.md (with track, title and evidence: browser, interview or local).
2. The learner store in src/lib/store: the data model in SPEC section 12, Zod validation on load (zod/mini on the client), migrations, read-modify-write with storage-event handling for multiple tabs, export to a dated file, import with validation and replace-or-merge, and the recovery screen for corrupt data.
3. The Settings page: start date (must be a Monday), hours per week (default 5), job track, review caps, keyboard shortcuts on or off, storage status (call navigator.storage.persist() on first run), export, import, and reset with confirmation. Show the export banner after 7 days without an export.

Tests: unit tests for migrations, merge rules, export/import round trips, corrupt input and the Monday rule; e2e tests that set a start date, reload, export, and import into a fresh browser context, with an axe check. Open a pull request when `npm run check:full` passes.
```

## Phase 3: Python in the browser

```
Phase 3: the Python runner and grader. Follow docs/SPEC.md sections 6 and 7 ("Python exercises" and "Write-tests exercises") exactly.

- Pyodide in a module Web Worker, one PYODIDE_VERSION constant (with a unit test that it matches the pyodide npm version), PYTHONHASHSEED 0, loaded on demand with a progress indicator. Show static highlighted starter code until the learner focuses the editor or presses Run.
- The Exercise island with CodeMirror 6 (loaded on demand): Run, Run tests, Check, Reset and "I'm stuck"; drafts in IndexedDB; the Tab-escape hint.
- Clean state per run (modules, files, import caches), the timeout that terminates and recreates the worker, trimmed tracebacks.
- Grading: test discovery, visible and hidden tests (hidden tests and solutions fetched as static JSON only when needed), feedback mapping, the hint ladder, credit rules including the tutor cap, solution locking, and the 15-minute "stuck" nudge.
- Write-tests exercises with pytest, graded against a correct implementation and buggy ones.
- The same grader under Node: worker_threads with the same message protocol and timeout, --experimental-wasm-jspi, and a package cache directory.

Create two sample exercises (one make, one write-tests) following docs/CONTENT_GUIDE.md section 4. The "I'm stuck" button can copy a placeholder prompt for now; phase 7 adds the real templates.

Tests: unit tests for the grader (pass, fail, exception, syntax error, infinite loop, hidden-test feedback, hint and tutor credit, stale-module cleanup, write-tests grading) and e2e tests that run both samples using only the keyboard, with an axe check. Serve Pyodide from node_modules in e2e. Open a pull request when `npm run check:full` passes.
```

## Phase 4: SQL in the browser

```
Phase 4: the SQL runner and grader. Follow docs/SPEC.md section 7 ("SQL exercises") exactly: a template database per exercise and a fresh clone per query, the worker-termination timeout, array row mode with field metadata, value normalisation, result comparison, the two check forms (true-returning queries and expectError), plan checks on seeded data, and the structural checks for queue-claim statements. The same grader must run under Node.

Add three sample SQL exercises: a left join with two wrong solutions, a pgvector nearest-neighbour query, and a DDL exercise where a duplicate booking must fail with SQLSTATE 23505. Unit and e2e tests as in phase 3 (run the PGlite sample against `astro preview`). Open a pull request when `npm run check:full` passes.
```

## Phase 5: questions, practice items and lesson components

```
Phase 5: questions, mastery checks and the lesson components. Follow docs/SPEC.md sections 5 and 7 ("Question types" and "Mastery check") and docs/CONTENT_GUIDE.md sections 3 and 5.

1. Question types: single and multiple choice (an explanation for every option), short answer, predict-the-output, Parsons with distractors and the full keyboard alternative, spot-the-bug, ordering, and the confidence picker. For predict items, write the build step that runs each item with the Node grader and stores its output as ground truth; the browser never computes answers.
2. Checklist and rubric items from src/content/practice/, self-assessed and stored.
3. The components Chunk (with chunk anchors), Quiz (filtered by chunk), WarmUp, MasteryCheck (with a count), Callout, SessionBreak, InterviewCorner and LabStep (which shows "coming soon" until its milestone page exists), as .astro wrappers available in MDX through auto-import. Pools come from build-time JSON, never props. Apply the rules for published versus planned lessons, the 30% interleaving rule and its condition, the orientation exemption, remedial routing to chunk anchors, and retakes with different questions and a different mastery make exercise.

Record every answer in the store. Unit-test scoring and selection; e2e-test every component with the keyboard only, with axe checks. Open a pull request when `npm run check:full` passes.
```

## Phase 6: spaced repetition

```
Phase 6: spaced repetition. Follow docs/SPEC.md section 8.

Use ts-fsrs with desired retention 0.9, Athena's own card schema with conversion at the boundary, the four card types, unlocking a lesson's cards when it's mastered, learner-made cards, the Review page with interleaved order, ratings 1 to 4 that work only while the rating group has focus (and can be switched off), daily caps, the due count in the header and on Home, and the lapse and needs-review rules. Warm-up answers must not change card schedules.

Unit-test scheduling with a fixed clock; e2e-test a full review session. Open a pull request when `npm run check:full` passes.
```

## Phase 7: Claude prompts and the Interview Gym

```
Phase 7: Claude prompts and the Interview Gym. Follow docs/SPEC.md sections 9 and 11.

1. The prompt builders, using the templates in SPEC section 11 word for word: the tutor button (replacing the phase 3 placeholder), ExplainBack, and every mock interview type including system design and the full loop. Open the Claude tab first, then copy the prompt, then show the "Prompt copied" message. Afterwards the learner logs scores and gaps; any gap can become a review card in one click.
2. The Interview Gym: approach practice (untimed), timed solo, mixed sets with hidden patterns, the re-attempt queue (ts-fsrs, separate from daily Review), the think-aloud checklist, attempt logging, code-reading drills (multi-file, with the clean-state rules), AI-assisted drills with a reflection log, and the STAR story builder with a 2-minute timer.

Add three sample gym problems, one code-reading drill and one AI-assisted drill following docs/CONTENT_GUIDE.md section 7. Unit-test the prompt builders and timers; e2e-test a timed problem and a mock-interview log. Open a pull request when `npm run check:full` passes.
```

## Phase 8: dashboard and competencies

```
Phase 8: Home and the Competencies page. Follow docs/SPEC.md section 13.

Home: setup steps until a start date exists; then this week's plan from curriculum.yaml (published lessons, or "coming soon" for planned ones), the gym focus, the lab milestone and the job-search targets; reviews and gym re-attempts due; the current lesson with a resume link; the weekly log with one-click export; the consistency streak; and the "course complete" view after week 28. Compute weeks on local calendar dates.

Competencies page: every competency with its computed level (using the separate rules for browser, interview and local evidence), the self-rating beside it, the evidence behind it, the rusty flag and the overconfident list.

Unit-test the week calculation (including across a daylight-saving change) and every level rule; e2e-test Home with a fixed date. Open a pull request when `npm run check:full` passes.
```

## Phase 9a: the content validator

```
Phase 9a: finish scripts/validate-content.ts so it does everything in docs/CONTENT_GUIDE.md section 8, using the same Python and SQL graders the browser uses, including the predict determinism check, the time estimates, the coverage rules and the safety rules. Make sure the sample content from earlier phases passes, and wire the validator into CI. Unit-test the validator itself with small good and bad fixtures. Open a pull request when `npm run check:full` passes.
```

## Phase 9b: the golden lesson

```
Phase 9b: write lesson py-01 "Names, values and mutability" from docs/CURRICULUM.md completely: the MDX page, every exercise (including two mastery make exercises), the question pools, cards and interview corner, following docs/TEACHING.md and docs/CONTENT_GUIDE.md. This lesson sets the quality bar for all others, so take your time. Check every technical claim against official Python documentation and link the pages you used. Run `npm run validate` until it passes, then the review procedure in docs/CONTENT_GUIDE.md section 10. Set the lesson to published in curriculum.yaml.

Show me the reviewer's final report and open a pull request, then stop so I can try the lesson myself before we write more.
```

## Content phases (10, 11, 15, 16, 18, 19): one lesson per session

Use this prompt for each lesson, replacing `{phase}` and `{lesson id}`:

```
Phase {phase}: write lesson {lesson id} from docs/CURRICULUM.md at the quality of py-01, following docs/TEACHING.md and docs/CONTENT_GUIDE.md. Check every technical claim against official documentation and link the pages you used. Run `npm run validate` until it passes, then the review procedure in docs/CONTENT_GUIDE.md section 10. Set the lesson to published in curriculum.yaml. If the lesson has a "Use it in your project" step, link it to the lab milestone page (or to "coming soon" if the lab isn't built yet). Open a pull request, and list anything you were unsure about and anywhere you departed from the curriculum, with reasons.
```

| Phase | Lesson ids |
| --- | --- |
| 10a | start-00 (also write the Start here and About pages) |
| 10b, 10c, 10d | git-01, sec-01, wri-01 |
| 11a to 11h | py-02, py-03, py-04, sql-01, py-05, sql-02, py-06, sql-03 |
| 15a to 15e | sql-04, api-01, oss-01, api-02, api-03 |
| 16a to 16e | ai-01, ai-02, ai-03, ops-01, ops-02 (for ops-02, add: check current Cloud Run, Secret Manager and managed PostgreSQL docs and pricing pages, and date any pricing note) |
| 18a to 18f | rag-01, rag-02, eval-01, eval-02, ops-03, eval-03 (add: check pgvector details against github.com/pgvector/pgvector) |
| 19a to 19c | sys-01, ts-01, int-01 |

## Phase 12: Interview Gym content, first batch (12a, 12b, 12c)

```
Phase 12{a|b|c}: write the next batch of Interview Gym items from the "Interview Gym plan" in docs/CURRICULUM.md. Batch a: the 6 approach-practice problems and 4 hashing problems. Batch b: the other 2 hashing problems, 4 two-pointer and 4 sliding-window problems. Batch c: 5 stack and 5 binary search problems, plus 4 code-reading drills and 2 AI-assisted drills. All easy.

Every problem must be original (nothing copied from LeetCode or anywhere else), use realistic domains, and follow docs/CONTENT_GUIDE.md section 7, with at least two wrong solutions that reflect common mistakes. Validate, run a fresh reviewer subagent over the batch, fix, and open a pull request.
```

## Phase 13: quality pass and launch

```
Phase 13: quality pass before I start studying.

- Run axe on every page type and fix everything. Walk through a full lesson, a review session and a gym problem using only the keyboard.
- Run Lighthouse (mobile) on Home, a lesson and Review, and meet the budgets in docs/SPEC.md section 14, including the initial-load JavaScript budget.
- Run the e2e suite on Chromium, Firefox and WebKit, and check layouts at 390 pixels wide.
- Confirm no requests go anywhere except the pinned runtime assets, and that hidden tests and solutions are not in the initial page HTML or the search index.
- Check that `git ls-files` contains nothing private.
- Write README.md: what Athena is, how to run it, how content is validated, and a short note that I designed it and built it with Claude Code.
- Open a pull request; after I merge it, confirm the live site works and list anything left unfinished.
```

## Phase 14: the labs (14a, 14b, 14c)

```
Phase 14a: Lab A (labs/webhook-agent). Follow docs/SPEC.md section 10 and the Lab A section of docs/CURRICULUM.md.

1. Write labs/webhook-agent/CONTRACT.md first: every request and response body, status codes (including for duplicates), job status values, where event_id lives, the signature header, environment variables, the test-mode rules and startup refusal, the fake-model script format (keyed by event_id and step), test-mode backoff timing, the simulate_failure and ping events, result.steps, and the smoke marker.
2. Then a milestone spec at labs/webhook-agent/milestones/<id>.md for each of wa-m1 to wa-m7, and the acceptance suites (pytest and httpx; poll with timeouts; secrets only from environment variables; refuse non-localhost URLs except with -m smoke), the signed-webhook sender, and fixtures/fake_llm_script.json. Everything must be invented: no real names, numbers or conversations.
3. The labs folder must never contain an implementation. Test the suites in tests/lab_contract/ against table-driven fakes built on httpx.MockTransport, and show each suite fails against at least three broken fakes. Add `npm run test:labs` (pytest, with Python managed by uv) and include it in check:full.

Open a pull request when `npm run check:full` passes.
```

```
Phase 14b: Lab B (labs/rag-evals), the same way as 14a: CONTRACT.md first (including the search.py and metrics.py command contracts and the database check through ATHENA_DATABASE_URL), milestone specs at labs/rag-evals/milestones/<id>.md (re-m1 to re-m5), the synthetic data/memories.jsonl (about 300 invented memories from invented callers) and data/queries_seed.jsonl (20 labelled queries), the acceptance suites and toy-data tests, and contract tests against fakes as docs/SPEC.md section 10 describes (stub scripts for the commands, a seeded fixture database for the database check, and at least three broken fakes). Show with a simple keyword baseline that the re-m1 threshold (a relevant id in the top 10 for at least 80% of seed queries) is reachable on this data. Add Lab B to the Labs pages. Open a pull request when `npm run check:full` passes.
```

```
Phase 14c: the Labs pages for Lab A: its contract, each milestone's checklist and acceptance criteria, how to run the suite, and an evidence field (a commit URL) stored in the learner store. Link each lesson's "Use it in your project" step to its milestone page. Open a pull request when `npm run check:full` passes.
```

## Phase 17: Interview Gym content, second batch

```
Phase 17: write the remaining Interview Gym content from the "Interview Gym plan" in docs/CURRICULUM.md, in sessions of about 10 items: 22 more problems (4 recursion, 6 trees, 4 heaps, 4 graphs, 4 sorting and intervals; at least 15 of the 22 medium, and an easy one first in each pattern), 6 more code-reading drills and 4 more AI-assisted drills. Same rules as phase 12. Open a pull request per batch.
```

---

## Ongoing prompts

### Weekly check-in

```
I've copied my exported progress file into this folder (it matches *progress*.json, which is gitignored; don't commit it). Read it with docs/CURRICULUM.md, docs/COMPETENCIES.md and private/LEARNER.md. Tell me what I completed this week, which competencies are below target, where I'm overconfident, and whether I'm on schedule. Propose up to three changes for next week. Don't change any files until I agree.
```

### Remedial lesson

```
I failed the mastery check for {lesson id} twice. My mistakes: {paste them}. Write a short remedial lesson with id {lesson id}-r1 (60 to 90 minutes) that targets those misconceptions with different examples, following docs/TEACHING.md, with fresh mastery items. Validate, run the review procedure, and open a pull request.
```

### New job postings

```
Here are job postings I want to target: {links or pasted text}. Compare their requirements with docs/COMPETENCIES.md and docs/CURRICULUM.md. List skills that appear often but aren't covered, and propose new lessons or electives and where they'd fit. Don't change any files until I agree.
```

### Elective

```
Write elective {elective id} from the electives list in docs/CURRICULUM.md at the quality of py-01, using the content-phase prompt.
```

### Bug report

```
Something is wrong on the site: {what I did, what I expected, what happened, browser}. Reproduce it with a failing test first, then fix it, run `npm run check:full`, and open a pull request.
```
