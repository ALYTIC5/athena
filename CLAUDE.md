# Athena: working rules for Claude Code

Athena is a static learning site (Astro + Starlight, deployed to GitHub Pages) that makes one learner job-ready for junior roles in AI automation, backend Python and AI application engineering. It teaches, tests and tracks progress entirely in the browser.

Read these before any task, every session:

- `docs/SPEC.md`: what the product does and how it is built
- `docs/TEACHING.md`: the teaching rules every piece of content must follow
- `docs/CONTENT_GUIDE.md`: file formats, schemas, validation and the quality bar for content
- `docs/CURRICULUM.md`: the 28-week syllabus and the two labs, in order
- `docs/COMPETENCIES.md`: what the learner must know and be able to do
- `private/LEARNER.md`: who the learner is (local only, never committed)
- `docs/PROMPTS.md`: the build phases; work only on the phase you are asked for

## Non-negotiables

1. **No secrets, ever.** No API keys, tokens or `.env` files in the repo. The site must work with no keys at all. gitleaks runs as a pre-commit hook and in CI; never bypass or disable it. Synthetic secrets used in teaching material must contain the marker `ATHENA_FAKE` (allowlisted by one regex in `.gitleaks.toml`). Never allowlist paths.
2. **Static only.** No backend, serverless functions, analytics, cookies or trackers. All learner data stays in the browser (localStorage and IndexedDB) and can be exported and imported as JSON. The only network requests allowed are the pinned runtime assets (Pyodide and PGlite) and links the learner clicks.
3. **Private stays private.** Never commit anything under `private/`, exported progress files (`*progress*.json`), real personal data, or any summary of `private/LEARNER.md`, progress data or job-search data, including in commit messages, pull request text and page content. In public files, call the reader "the learner". The repo is public.
4. **Every auto-graded exercise is verified.** A reference solution must pass its tests and every listed wrong solution must fail them, using the same grader the browser uses. `npm run validate` checks this and CI blocks anything that fails. Checklist and rubric items are self-assessed and exempt.
5. **Accuracy over volume.** Check technical claims against official documentation and link the page used, for example: docs.python.org, docs.pytest.org, www.python-httpx.org, fastapi.tiangolo.com, docs.pydantic.dev, postgresql.org/docs, github.com/pgvector/pgvector, platform.claude.com/docs, platform.openai.com/docs, git-scm.com/docs, docs.github.com, docs.docker.com, docs.cloud.google.com/run/docs, developer.mozilla.org, rfc-editor.org, owasp.org, docs.stripe.com, twilio.com/docs. If you are unsure, leave it out and list it in your summary.
6. **Original content only.** Do not copy text, code or problems from books, courses, LeetCode or other sites. Write original explanations and problems.
7. **Synthetic data only.** Invent all example data. Phone numbers only from reserved fictional ranges (UK +44 7700 900000 to 900999, US 555-0100 to 555-0199); email addresses only at example.com, example.org, example.net or .test. Never use the learner's clients, products, callers or conversations.
8. **Accessible by default.** Every interactive component works with the keyboard alone and with a screen reader, meets WCAG 2.2 AA contrast, and never uses colour as the only signal.
9. **Small, reviewable steps on a branch.** Work only within the phase asked for, on a branch named after the phase. Commit after each completed unit with a conventional-commit message (`feat:`, `fix:`, `content:`, `test:`, `docs:`, `chore:`). Run `npm run check` before each commit. When the phase is done, open a pull request and summarise it; the learner reviews and merges (every merge to `main` deploys).
10. **Ask before big decisions.** If a spec is ambiguous or a dependency has changed in a way that breaks the spec, stop and ask with a recommended option instead of guessing.
11. **Protect your context.** If the session's context is more than about half used, commit, write a short summary of what's done and what's next in the pull request description, and stop. The next session continues from `git log` and that summary.

## Commands (create these in phase 1)

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run lint` and `npm run typecheck`
- `npm test` (Vitest unit tests)
- `npm run validate` (content validation and exercise verification)
- `npm run e2e` (Playwright on Chromium) and `npm run e2e:all` (Chromium, Firefox and WebKit)
- `npm run test:labs` (from phase 14a): runs the lab contract tests in `tests/lab_contract/` with pytest (Python managed with uv)
- `npm run check`: lint, typecheck, unit tests, validate and build
- `npm run check:full`: `check` plus `e2e:all`, `test:labs` (once it exists) and the size budget; CI runs this

## Definition of done for any task

- `npm run check` passes (and `check:full` before a pull request), and the site builds with no console errors on the pages you touched
- New UI works with the keyboard only and passes an axe check in an end-to-end test
- Docs are updated if behaviour changed
- Your summary lists what changed, what you checked, and anything you were unsure about

## When writing content

Follow `docs/TEACHING.md` and `docs/CONTENT_GUIDE.md` exactly. Lesson `py-01` (built in phase 9b) is the quality bar for every later lesson. After drafting any lesson, run the review procedure in `docs/CONTENT_GUIDE.md` section 10: a fresh reviewer subagent with no knowledge of how you wrote it. Fix every blocker and major issue, and minor ones where quick. Repeat until it finds nothing above minor, for at most three rounds, then list what remains.
