# Athena

A personal learning site that makes one learner job-ready for junior roles in AI automation, backend Python and AI application engineering. Lessons, in-browser Python and SQL exercises that check your answers, spaced review, an interview gym and two project labs, all running in the browser on GitHub Pages.

This repo starts as a starter kit of specs. Claude Code builds the site from them using the prompts in `docs/PROMPTS.md`. This README is rewritten in phase 13 once the site exists.

| File | What it is |
| --- | --- |
| `CLAUDE.md` | Rules Claude Code follows in every session |
| `docs/SPEC.md` | Product and technical spec |
| `docs/TEACHING.md` | Teaching rules for all content |
| `docs/CONTENT_GUIDE.md` | Content formats, validation and the quality checklist |
| `docs/CURRICULUM.md` | The 28-week syllabus and the two labs |
| `docs/COMPETENCIES.md` | What the learner must know and be able to do |
| `docs/PROMPTS.md` | The build prompts, in order, and when each must be ready |
| `private/LEARNER.md` | The learner profile (gitignored, never committed) |

## Before you start

**To build the site:**

- Node.js 22.12 or newer, Git, the GitHub CLI and Claude Code
- GitHub CLI logged in with the workflow scope: `gh auth login`, then `gh auth refresh -s workflow`
- gitleaks installed (Claude Code sets up the pre-commit hook in phase 1)
- Playwright browsers: `npx playwright install --with-deps` (after phase 1)
- Your GitHub noreply email address (GitHub Settings, Emails), so your personal email isn't in public commits
- From phase 14a: Python with uv, for the lab contract tests

**For the labs, later:**

- Python matching the version Pyodide ships (3.14 at the time of writing), ideally with uv
- A way to run PostgreSQL locally by week 9 (installer or Docker), and Docker itself by week 18
- An LLM API key with a monthly spending limit set at the provider, by week 14
- A Google Cloud account with a billing budget alert, and a free managed PostgreSQL (for example Supabase or Neon), by week 19

**How the build runs:**

- One phase per Claude Code session, on a branch, ending in a pull request you review and merge.
- Every merge to `main` deploys the site, after CI passes.
- To undo a bad phase, close its pull request without merging, or `git revert` the merge.
