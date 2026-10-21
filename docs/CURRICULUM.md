# Curriculum: 28 weeks at about 5 hours a week

This is the source for `src/content/curriculum.yaml` and for every lesson. Each week has about 2.75 hours of lessons and lab work plus 15 minutes of review, 1 hour of Interview Gym and 1 hour of job search.

**Why these topics:** an analysis of 136 real postings (October 2026) for junior roles in AI automation, backend Python, AI engineering, voice AI, AI solutions and full-stack web found: Python 61%, English communication 59%, REST APIs and webhooks 54%, AI agents and tool calling 38%, SQL 37%, cloud 35%, LLM APIs 32%, prompt engineering 29%, TypeScript 29%, JavaScript 28% (JavaScript or TypeScript together 46%), RAG 27%, client-facing work 26%, Git 24%, workflow automation 24%, voice AI 24%, evals and monitoring 20%, CI/CD 19%, Docker 18%, testing 18%, React 18%. Go, GraphQL and MCP were each under 10%. Use these numbers in each lesson's "Why this matters".

Lesson ids are stable and used everywhere (files, tags, progress data). Remedial lessons use `<lesson-id>-r<n>` (for example `py-02-r1`).

In `curriculum.yaml`, every lesson has `status: planned` or `status: published`. Only published lessons appear as lessons; planned ones show as "coming soon". A published lesson must not reference content of a planned lesson, except in `prerequisites`, which may name any lesson. Content belonging to planned lessons is schema-checked and graded but not rendered.

## Overview

| Week | Lessons | Lab work | Interview Gym (1 hour) |
| --- | --- | --- | --- |
| 1 | start-00 How Athena works (40 min); git-01 Git and GitHub as a team member (2 h) | | (start-00 teaches the think-aloud approach) |
| 2 | sec-01 Secrets and security hygiene (1.5 h); wri-01 READMEs, pull requests and design notes (1.25 h) | | Approach practice, untimed: 2 |
| 3 | py-01 Names, values and mutability (2.75 h) | | Approach practice, untimed: 2 |
| 4 | py-02 Collections and complexity (2.75 h) | | Hashing: 2 easy |
| 5 | py-03 Functions in depth (2.75 h) | | Hashing: 2 easy |
| 6 | py-04 Errors, files and data formats (2 h); sql-01 Querying one table (45 min) | | Two pointers: 2 easy |
| 7 | py-05 Classes, types and packages (2 h); sql-02 Joins and aggregation (45 min) | | Sliding window: 2 easy |
| 8 | py-06 Testing with pytest (2 h); sql-03 Designing schemas (45 min) | | Stack: 2 easy |
| 9 | sql-04 Indexes, transactions and PostgreSQL from Python (2 h) | wa-m1 (45 min) | Binary search: 2 easy |
| 10 | api-01 HTTP and REST (1.75 h); oss-01 Your first open-source contribution (1 h) | | Code-reading drill 1; 1 mixed |
| 11 | api-02 Building APIs with FastAPI (1.5 h); api-03 Webhooks done right (1.25 h) | | Recursion: 2 |
| 12 | | wa-m2 (2.75 h) | Trees, depth-first: 2 |
| 13 | | wa-m3 (2.75 h) | Trees, breadth-first: 1; AI-assisted drill 1 |
| 14 | ai-01 LLM APIs and structured output (2 h) | wa-m3 finish (45 min) | Heaps: 2 |
| 15 | ai-02 Tool calling and the agent loop (2 h) | wa-m4 (45 min) | Graphs: 2 |
| 16 | ai-03 Guardrails, prompt injection and cost (1.25 h) | wa-m4 finish (1.5 h) | Sorting and intervals: 2 |
| 17 | | wa-m5 (2.75 h) | Code-reading drill 2; 1 mixed |
| 18 | ops-01 Docker and CI (1.5 h) | wa-m6 (1.25 h) | Mixed set: 2, one medium |
| 19 | ops-02 Deploying to the cloud (1.5 h) | wa-m6 finish (1.25 h) | AI-assisted drill 2; 1 medium |
| 20 | | wa-m7 (2.75 h) | Mixed: 1 medium; re-attempts |
| 21 | rag-01 Embeddings and vector search (1.75 h) | re-m1 (1 h) | Mock: project deep-dive |
| 22 | rag-02 Retrieval pipelines (1.75 h) | re-m1 finish (1 h) | Code-reading drill 3; re-attempts |
| 23 | eval-01 Eval sets and retrieval metrics (1.75 h) | re-m2 (1 h) | STAR stories 1 to 3; behavioural mock |
| 24 | eval-02 Experiments and honest reporting (1.75 h) | re-m3 (1 h) | STAR stories 4 to 6; 1 mixed |
| 25 | ops-03 Observability for LLM apps (1 h) | re-m3 finish and re-m4 (1.75 h) | Mock: live coding |
| 26 | eval-03 Evals in CI (45 min) | re-m4 finish and re-m5 (2 h) | Mock: concept round (AI and retrieval) |
| 27 | sys-01 System design for juniors (1.75 h); ts-01 Reading your own TypeScript (1 h) | | Mock: system design |
| 28 | int-01 Interview readiness (2 h) | | Full mock loop (about 2 hours: the Gym hour plus the job-search hour) |

**Job search, every week from week 2:** 1 to 3 tailored applications and 1 or 2 freelance pitches. **Open source:** find an issue in week 10 and open one pull request by week 14; a merged pull request is a bonus, not a requirement.

**Gym checkpoints:** about 10 timed problems by week 8, about 30 by week 28, plus drills and mocks.

---

## Lessons

Format for each lesson: competencies (from `docs/COMPETENCIES.md`), objectives, what to cover, exercises, interview corner topics. Lessons under 2 hours use the short anatomy in `docs/TEACHING.md`.

### Week 1

**start-00: How Athena works (40 minutes).** Orientation: no warm-up, mastery check or cards. Competencies: int.approach (introduced).
- Objectives: use every exercise type; set a start date; export progress and understand the Safari storage rule; explain the AI rule (tutor, not author); describe the think-aloud approach (clarify, examples, brute force, optimise, code, test, complexity).
- Exercises: one of each question type on a trivial topic, so the learner meets the interface before the content.

**git-01: Git and GitHub as a team member (2 hours).** Competencies: git.branching, git.pull-requests, git.rebase-merge, git.undo, git.commits.
- Objectives: explain commit, branch and HEAD; choose merge or rebase and explain why; resolve a conflict; undo safely (revert, reset, restore); rewrite history safely when necessary (what `git filter-repo` and force-push do, and why they are dangerous on shared branches); open a reviewable pull request.
- Cover: feature branches, small commits, conventional commits, pull requests, review etiquette, rebase versus merge, conflicts, undoing, history rewriting and its consequences.
- Exercises: ordering (a feature workflow); predict the history after a sequence of commands (multiple choice with diagrams); spot-the-bad-commit-message; a local practice repo as a checklist with exact commands.
- Interview corner: the team workflow, merge versus rebase, undoing a pushed commit.

### Week 2

**sec-01: Secrets and security hygiene (1.5 hours).** Competencies: sec.secrets, sec.history, sec.least-privilege, sec.owasp-basics.
- Objectives: explain why a pushed secret is compromised even after deletion; put the incident steps in order (revoke and rotate first, then purge history, then prevent); set up gitleaks as a pre-commit hook; explain why keys in client-side JavaScript are public; explain three OWASP Top 10:2025 risks: broken access control (A01), injection (A05) and authentication failures (A07).
- Cover: `.env` and `.env.example`, `.gitignore`, secret managers, GitHub secret scanning and push protection, purging with `git filter-repo` (building on git-01), least-privilege keys, and in brief the other Top 10:2025 items most relevant to the learner's work: security misconfiguration (A02) and software supply chain failures (A03). Check the categories against owasp.org.
- Exercises: ordering (incident response); spot-the-leak in a synthetic repo listing and in client-side code; multiple choice on the OWASP risks; a checklist the learner applies to their own repos (self-assessed; repos are not named on the site). All fake secrets contain `ATHENA_FAKE`.
- Interview corner: "You pushed a key. What now?", "How do you manage secrets across environments?", "What is injection and how do you prevent it?"

**wri-01: READMEs, pull requests and design notes (1.25 hours).** Competencies: wri.readme, wri.pr-description, wri.design-note.
- Objectives: list what a README must answer; write a pull request description; write a one-page design note (context, goals, non-goals, options, decision, risks).
- Exercises: critique a synthetic poor README against a rubric, then rewrite one section; a rubric-based design note for a tiny service; explain-back with Claude reviewing the learner's own README draft (pasted into Claude, never into the site).

### Week 3

**py-01: Names, values and mutability (2.75 hours). The golden lesson: the quality bar for all others.** Competencies: py.values-names, py.mutability, py.control-flow, py.functions.
- Objectives: explain that names refer to objects and assignment never copies; predict the effect of mutating a list passed to a function; explain and avoid the mutable default argument bug; choose between `==` and `is` (use `is` for `None` and other singletons or sentinels); write a function that returns a new list instead of mutating its input.
- Cover: objects and names, `id()`, mutable versus immutable types, aliasing, shallow copy (`list()`, `.copy()`, slicing) versus deep copy, mutable default arguments, truthiness, `==` versus `is`.
- Exercises: predict items on aliasing; faded example copying a list of booking dicts; Parsons (a function that returns a filtered copy); debug (a booking scheduler that shares one default list between calls); make (`reschedule(bookings, booking_id, new_slot)` returning a new list without mutating the input, with hidden tests for unknown ids, empty lists and input left unchanged).
- Interview corner: passing a list to a function, `==` versus `is`, the mutable default argument.

### Week 4

**py-02: Collections and complexity (2.75 hours).** Competencies: py.collections, py.comprehensions, py.complexity.
- Objectives: choose the right collection for a task; explain the cost of membership tests in lists, sets and dicts; write comprehensions; use `Counter`, `defaultdict` and `sorted` with a key; state the big-O of a simple function.
- Cover: list, tuple, set, dict; dicts keep insertion order; comprehensions and generator expressions; `collections`; sorting with `key=`; big-O for common operations.
- Exercises: predict items; faded (group calls by caller with `defaultdict`); Parsons; debug (a quadratic duplicate check: graded by counting comparisons on an instrumented input, or by an input large enough that the quadratic version exceeds the timeout at least tenfold, never by a tight timing threshold); make (summarise a day of call logs: calls per caller, busiest hour, top 3 reasons).
- Interview corner: set versus list lookup, when to use a tuple, big-O of your solution.

### Week 5

**py-03: Functions in depth (2.75 hours).** Competencies: py.scope-closures, py.args-kwargs, py.decorators, py.iterators-generators.
- Objectives: explain LEGB scope and the late-binding closure trap; use `*args`, `**kwargs` and keyword-only arguments; write a decorator with `functools.wraps`; write a generator and explain why it saves memory.
- Cover: scope, closures, first-class functions, decorators, iterators, generators, `yield`, `itertools` basics.
- Exercises: predict items (closures in loops); faded (a timing decorator that takes a fake clock); Parsons (a generator that yields records in batches); debug (a closure capturing the loop variable); make (a caching decorator that remembers results per argument tuple, with tests that count calls to the wrapped function).
- Interview corner: what `yield` does, a decorator you've written, `*args` and `**kwargs`.

### Week 6

**py-04: Errors, files and data formats (2 hours).** Competencies: py.exceptions, py.context-managers, py.files-json, py.datetime.
- Objectives: raise and handle specific exceptions; write a context manager; read and write JSON and CSV with `pathlib`; convert between time zones with `zoneinfo`; explain EAFP versus LBYL; write a `retry` decorator that retries only listed exceptions.
- Cover: exception hierarchy, `try`/`except`/`else`/`finally`, custom exceptions, `with`, `pathlib`, `json`, `csv`, aware versus naive datetimes, ISO 8601, storing times in UTC. Exercises using `zoneinfo` list `packages: [tzdata]` and take `now` as an argument.
- Exercises: predict items on exception flow; faded (load bookings JSON and validate fields); debug (naive datetimes compared across time zones); make (parse a CSV export of appointments, convert local times to UTC, skip and report invalid rows with reasons); mastery make (a `retry` decorator with a maximum number of attempts and a list of retryable exceptions, tested with a fake function that fails twice then succeeds).
- Interview corner: handling errors from an external API, storing times, EAFP.

**sql-01: Querying one table (45 minutes, short anatomy).** Competencies: sql.select, sql.nulls.
- Objectives: select, filter, sort and limit; handle NULLs correctly.
- Exercises (PGlite): a calls table; 6 short query exercises and one NULL trap (`= NULL` versus `IS NULL`).

### Week 7

**py-05: Classes, types and packages (2 hours).** Competencies: py.classes, py.typing, py.packages.
- Objectives: write a class with methods; use dataclasses (including `field(default_factory=...)`); add type hints and check them with a type checker; explain that hints are not enforced at runtime; structure a small package; explain virtual environments and pinned dependencies.
- Cover: classes, `__init__`, methods, `@dataclass` (including `frozen=True`), composition over inheritance, type hints, unions and `None`, `typing.Protocol` briefly, modules and packages, `venv` or `uv`, `pyproject.toml`.
- Exercises: predict items; faded (a `Booking` dataclass); Parsons; debug (a mutable list defined as a plain class attribute and shared by every instance; note that dataclasses refuse a bare mutable default and raise `ValueError`, which is why `default_factory` exists); make (a `Schedule` class that prevents double-booking a slot, with type hints and tests).
- Interview corner: dataclass versus dict, why type hints, how you manage dependencies.

**sql-02: Joins and aggregation (45 minutes, short anatomy).** Competencies: sql.joins, sql.aggregation.
- Objectives: write inner, left and self joins; aggregate with GROUP BY and HAVING; explain WHERE versus HAVING.
- Exercises (PGlite): customers, bookings and calls tables; 6 exercises including "customers with no bookings" (left join with IS NULL) and a self join (bookings that overlap for the same customer).

### Week 8

**py-06: Testing with pytest (2 hours).** Competencies: py.pytest, py.mocking.
- Objectives: write tests with pytest; use fixtures and `parametrize`; test exceptions; replace an external dependency with a fake; explain unit versus integration tests.
- Cover: arrange, act, assert; fixtures; `parametrize`; `pytest.raises`; fakes versus mocks; `monkeypatch`; testing time with a fake clock; test-driven development in small steps.
- Exercises: write-tests exercises (the learner's tests must pass on the correct implementation and catch every buggy one); faded (parametrised tests for a slot validator); make (test first: write tests, then the function, for a phone number normaliser using only reserved fictional numbers).
- Interview corner: how you test code that calls an API or an LLM, what makes a good test.

**sql-03: Designing schemas (45 minutes, short anatomy).** Competencies: sql.schema, sql.normalisation, sql.parameters.
- Objectives: design tables with keys and constraints; normalise a messy table; explain why queries must be parameterised.
- Exercises (PGlite): design a bookings schema (DDL exercise with `compare: none`; checks confirm the constraints and that a duplicate booking for the same slot fails with SQLSTATE 23505); spot-the-injection in Python code that builds SQL with f-strings.

### Week 9

**sql-04: Indexes, transactions and PostgreSQL from Python (2 hours).** Competencies: sql.indexes, sql.transactions, sql.locking-queues, sql.window, sql.subqueries-ctes, sql.migrations, sql.jsonb, sql.parameters.
- Objectives: read EXPLAIN and add an index that changes the plan; explain ACID and READ COMMITTED; write a queue-claim statement with `FOR UPDATE SKIP LOCKED`; write a CTE, `ROW_NUMBER()` and a running total; store and query a webhook payload in JSONB; write a migration as up and down SQL; query PostgreSQL from Python with psycopg 3 and parameters.
- Cover: B-tree indexes, EXPLAIN versus EXPLAIN ANALYZE, transactions, isolation, row locks, queue tables (status, attempts, run_after), CTEs, window functions, JSONB operators, migrations (with Alembic as the common tool), psycopg 3, and setting up a local PostgreSQL (installer or a one-line container command, given as a checklist).
- Exercises (PGlite): an index exercise with a plan check; "each caller's most recent call" with a window function; a running total of bookings per day; a JSONB query; a migration as DDL with checks; the queue claim graded by result plus structural checks (see `docs/SPEC.md` section 7); a local checklist connecting from Python.
- Use it in your project: wa-m1.

### Week 10

**api-01: HTTP and REST (1.75 hours).** Competencies: api.http, api.methods, api.status-codes, api.rest-design, api.auth.
- Objectives: describe a request and response; choose methods and status codes; explain idempotency, 401 versus 403 and PUT versus PATCH; design REST endpoints with pagination; explain API keys, OAuth 2.0 (authorisation code flow, at a high level) and what a JWT contains and why it must be verified.
- Exercises: ordering (what happens when you call an API); multiple choice on status codes in realistic scenarios; a design exercise for booking endpoints (rubric, then explain-back); make (a cursor-pagination helper).
- Interview corner: 401 versus 403, idempotency, designing a booking endpoint.

**oss-01: Your first open-source contribution (1 hour, short anatomy).** Competencies: git.pull-requests, com.clarifying.
- Objectives: find a suitable issue; read CONTRIBUTING; fork, branch and open a small pull request; respond to review.
- Exercises: a checklist, and a template for the first comment on an issue; explain-back on the chosen issue.

### Week 11

**api-02: Building APIs with FastAPI (1.5 hours).** Competencies: api.fastapi, api.client, py.async.
- Objectives: build routes with Pydantic models; return correct status codes and errors; test with FastAPI's TestClient; call an external API with httpx using timeouts; use `async`/`await` to make several I/O calls concurrently.
- Note: FastAPI runs on the learner's machine, not in the browser (its test client needs threads, which Pyodide can't start). In-browser exercises cover Pydantic models, request-handling logic as plain functions, and async with a fake async client (top-level `await`). Local practice is a checklist with a provided pytest suite.
- Exercises: Pydantic validation exercises; an async exercise (gather three fake lookups with a timeout); local checklist (`/bookings` endpoints).

**api-03: Webhooks done right (1.25 hours, short anatomy).** Competencies: api.webhooks, api.idempotency, api.retries, api.rate-limits.
- Objectives: verify an HMAC signature over the raw body with a timestamp and `hmac.compare_digest`, before parsing the body; make a handler idempotent; compute exponential backoff with jitter; handle 429.
- Cover: at-least-once delivery, replay attacks, why the raw body matters, constant-time comparison, idempotency keys, provider differences (point to official docs, for example Stripe and Twilio, whose schemes differ).
- Exercises (browser): make `verify_signature(secret, header, raw_body, now)`; a spot-the-bug question (a signature check that parses JSON before verifying); mastery make `backoff_delays(attempts, base, cap, rng)` with a seeded random generator.
- Use it in your project: wa-m2 (next week).

### Weeks 12 and 13: lab weeks

No new lessons. wa-m2, then wa-m3. The lab pages link back to the relevant lessons.

### Week 14

**ai-01: LLM APIs and structured output (2 hours).** Competencies: ai.llm-basics, ai.structured-output, ai.streaming, ai.providers, ai.prompting, ai.cost-latency.
- Objectives: explain tokens, context windows, temperature and roles; get structured output and validate it with Pydantic; explain streaming and when to use it; put two providers behind one small interface; estimate the cost of a request; improve a prompt using a small test set.
- Note: real API calls happen locally with the learner's own keys in `.env` (with a spending limit set at the provider). In the browser, exercises use a scripted fake model.
- Exercises: cost estimation from token counts; make (an `LLMClient` protocol with a `FakeLLM`, and a function that classifies a call transcript into an intent with Pydantic validation and one retry on invalid output); prompt iteration (compare two prompts on 10 labelled transcripts using recorded outputs).
- Use it in your project: wa-m4.

### Week 15

**ai-02: Tool calling and the agent loop (2 hours).** Competencies: ai.tool-calling, ai.agent-loop, ai.testing, ai.workflow-vs-agent.
- Objectives: explain the tool-calling protocol; write an agent loop by hand with tools, state and a step limit; test it with a scripted fake model; decide when a fixed workflow is better.
- Exercises (browser, fake model): Parsons (the loop); debug (a loop that never ends when the model repeats a tool call); make (an agent with `lookup_availability`, `create_booking` and `escalate_to_human`, passing scripted scenarios).
- Use it in your project: wa-m4, then wa-m5.

### Week 16

**ai-03: Guardrails, prompt injection and cost (1.25 hours, short anatomy).** Competencies: ai.guardrails, ai.prompt-injection, ai.cost-latency.
- Objectives: validate tool arguments; add an allowlist and human approval for irreversible actions; explain direct and indirect prompt injection and why it can be reduced but not fully prevented; reduce cost per request.
- Exercises: make (guardrails around the week-15 agent; hidden tests include an injected transcript asking for 50 bookings); multiple choice on mitigations.
- Use it in your project: wa-m5 (next week).

### Week 17: lab week

No new lessons. wa-m5.

### Week 18

**ops-01: Docker and CI (1.5 hours).** Competencies: ops.containers, ops.compose, ops.ci, ops.test-pyramid, ops.secrets-ci.
- Objectives: write a Dockerfile with layer caching; run an app and PostgreSQL with Compose; write a GitHub Actions workflow for lint, type checks and tests; keep secrets out of images and logs.
- Exercises: spot-the-problems in Dockerfiles; a workflow gap-fill graded with Python tests (`packages: [pyyaml]`, checking the parsed YAML); local checklist.
- Use it in your project: wa-m6.

### Week 19

**ops-02: Deploying to the cloud (1.5 hours).** Competencies: ops.deploy, ops.iam, ops.environments, ops.rollback, ops.logging.
- Objectives: deploy a container to Google Cloud Run; read secrets from Secret Manager; use a managed PostgreSQL; explain revisions and roll back; diagnose a failure from logs.
- Cover: set a billing budget alert before anything else. Run the API as a Cloud Run service; run the worker as a Cloud Run worker pool (continuous, pull-based, no HTTP endpoint) or as a Cloud Run job on a schedule; a service with instance-based billing also works but must still serve HTTP. Managed PostgreSQL options: a free tier at Supabase or Neon, or Cloud SQL (no always-free tier). Check current official docs and pricing pages; never quote prices from memory; date any pricing note. AWS equivalents in one paragraph.
- Exercises: ordering (deploy steps); log-reading (find the error in a synthetic log); checklist.
- Use it in your project: wa-m7 (next week).

### Week 20: lab week

No new lessons. wa-m7.

### Week 21

**rag-01: Embeddings and vector search (1.75 hours).** Competencies: rag.embeddings, rag.pgvector, rag.chunking.
- Objectives: explain embeddings and cosine similarity; store and query vectors with pgvector; choose a chunking strategy.
- Exercises: cosine similarity by hand in Python, checked against numpy (`packages: [numpy]`); PGlite with pgvector (nearest neighbours with `<=>`); chunking synthetic call notes.
- Use it in your project: re-m1.

### Week 22

**rag-02: Retrieval pipelines (1.75 hours).** Competencies: rag.hybrid, rag.rerank, rag.context.
- Objectives: combine keyword and vector search with reciprocal rank fusion; explain re-ranking; build a context with citations within a token budget.
- Exercises: make (reciprocal rank fusion of two ranked lists); SQL full-text search with `tsvector`; debug (a context builder that exceeds the token budget).

### Week 23

**eval-01: Eval sets and retrieval metrics (1.75 hours).** Competencies: eval.datasets, eval.retrieval-metrics, eval.privacy.
- Objectives: build a labelled eval set; compute recall@k, precision@k and MRR; keep personal data out of eval sets.
- Exercises: make (`recall_at_k` and `mrr`, with hidden edge cases such as queries with no relevant documents); labelling with a rubric.
- Use it in your project: re-m2.

### Week 24

**eval-02: Experiments and honest reporting (1.75 hours).** Competencies: eval.answer-quality, eval.experiments.
- Objectives: run an experiment changing one variable; estimate uncertainty with a bootstrap; explain LLM-as-judge biases; write an honest result.
- Exercises: make (a seeded bootstrap confidence interval for a difference in recall); critique a synthetic eval report that overclaims.
- Use it in your project: re-m3 and re-m4.

### Week 25

**ops-03: Observability for LLM apps (1 hour, short anatomy).** Competencies: ops.logging, ops.tracing-metrics.
- Objectives: write structured logs with request ids that redact secrets and personal data; trace an agent run step by step; track tokens and cost per request.
- Exercises: make (a structured logger that redacts fake secrets and reserved-range phone numbers); log analysis.

### Week 26

**eval-03: Evals in CI (45 minutes, short anatomy).** Competencies: eval.ci.
- Objectives: run evals in CI with a threshold; avoid flaky gates; report results in pull requests.
- Use it in your project: re-m5.

### Week 27

**sys-01: System design for juniors (1.75 hours).** Competencies: sys.components, sys.scaling, sys.failure, sys.tradeoffs.
- Objectives: sketch a small system end to end with its data model, API and failure handling; state trade-offs; reason about scaling and rate limits.
- Exercises: design the webhook-to-agent system for 10 times the traffic (rubric, then the system design mock prompt); ordering and multiple choice on failure handling.

**ts-01: Reading your own TypeScript (1 hour, short anatomy).** Competencies: ts.types, ts.react (not core).
- Objectives: read and explain types, unions and narrowing, and a React component with state.
- Exercises: predict-the-type questions; explain-back on a file from the learner's own TypeScript project, pasted into Claude locally, never into the site.

### Week 28

**int-01: Interview readiness (2 hours).** Competencies: com.project-story, com.star, com.tradeoffs, com.client, int.approach.
- Objectives: deliver 2-minute and 10-minute stories for both labs and for past projects, honestly separating your own work from what tools or teammates produced; explain a technical decision to a non-technical client; prepare for the full mock loop; plan the next 12 weeks.
- Exercises: story builder; a client-explanation exercise (rubric, then explain-back); self-assessment against `docs/COMPETENCIES.md`.
- The full mock loop itself (concept, live coding, system design, project deep-dive, behavioural) runs in week 28's Gym and job-search hours, not inside this lesson.

### Electives (generate only when asked)

- **el-mcp:** build a small MCP server exposing the lab's booking tools.
- **el-frameworks:** rebuild the week-15 agent with a framework and compare it with the hand-written loop.
- **el-finetuning:** what fine-tuning is, when it helps, and why most applications use prompting and retrieval instead.
- **el-workflow-to-code:** move an n8n workflow into tested Python, and when that is worth it.
- **el-aws:** deploy the lab service on AWS.

---

## Interview Gym plan

- **Problem bank:** 52 original problems, at least 15 of them medium: approach practice (6, very simple), hashing (6), two pointers (4), sliding window (4), stack (5), binary search (5), recursion (4), trees (6), heaps (4), graphs (4), sorting and intervals (4). The first 30 (through binary search) are easy; the mediums come in the later patterns. Use realistic domains (bookings, calls, invoices, logs).
- **Code-reading drills:** 10, each a 100 to 200 line program in 2 to 4 files with a planted bug and a failing test.
- **AI-assisted drills:** 6.
- **Weekly focus:** as in the overview table. Failed problems return as re-attempts in the Gym's own queue.

---

## Labs

The learner writes both projects by hand, in their own public repos, and owns all the code and history. Athena provides only `CONTRACT.md`, milestone specs and black-box acceptance tests. Each lab's `CONTRACT.md` is written first and defines every detail the tests depend on (see `docs/SPEC.md` section 10).

### Lab A: webhook-to-agent service (`labs/webhook-agent`)

A Python FastAPI service that receives signed call-ended webhooks, queues them in PostgreSQL, and has a worker run an agent that classifies the call and books, cancels or escalates.

**Signature scheme for this lab:** header `X-Athena-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">` with a shared secret from `ATHENA_WEBHOOK_SECRET`. Verify before parsing the body. Reject signatures older than 300 seconds.

**Test mode:** on only when `ATHENA_TEST_MODE=1` and `ATHENA_ENV` is `test` or `development`. If `ATHENA_TEST_MODE=1` and `ATHENA_ENV` is anything else (including unset), or if any of `K_SERVICE`, `CLOUD_RUN_JOB` or `CLOUD_RUN_WORKER_POOL` is set (Cloud Run sets these), the service refuses to start. In test mode, a fake model replays the script named by `ATHENA_FAKE_LLM_SCRIPT` (a copy of `labs/webhook-agent/fixtures/fake_llm_script.json`), keyed by `event_id` and step number. `GET /health` returns JSON with `status: "ok"` and `test_mode: true` or `false`.

| Milestone | Weeks | Goal | Acceptance |
| --- | --- | --- | --- |
| wa-m1 | 9 | Design note and repo skeleton: `pyproject.toml`, ruff, pytest with one passing test, README | Checklist and evidence link (the design note and a green local test run) |
| wa-m2 | 12 | FastAPI service with `GET /health` and a signed `POST /webhooks/calls`; an in-memory store is fine | Health returns 200 with `status: "ok"`; bad or old signature returns 401, even with an invalid body; valid signature with an invalid body returns 422; valid returns 202 with a `job_id`; the same `event_id` again returns the same `job_id` |
| wa-m3 | 13 to 14 | PostgreSQL job store and worker | Jobs persist across restarts; `GET /jobs/{id}` shows status and attempts; workers claim with `FOR UPDATE SKIP LOCKED`, and with two workers every job is processed exactly once; retries back off (scaled down in test mode as the contract defines); a `simulate_failure` event ends as `dead` after the maximum attempts |
| wa-m4 | 15 to 16 | Model client and classification | In test mode, scripted transcripts produce the expected intent and validated fields on the job result |
| wa-m5 | 17 | Agent with tools and guardrails | In test mode, scripted conversations create the expected bookings (`GET /bookings`); the prompt-injection transcript creates no extra bookings and is escalated; `result.steps` shows 5 steps or fewer |
| wa-m6 | 18 to 19 | Docker, Compose and CI in the learner's repo | `docker compose up` then the full suite passes against localhost; CI green (evidence link) |
| wa-m7 | 20 | Deployed on Cloud Run with managed PostgreSQL | Smoke suite (`-m smoke`) passes against the deployed URL: health with `test_mode: false`; bad signature returns 401; a signed `ping` event is accepted; repeating it returns the same `job_id` |

### Lab B: memory retrieval with evals (`labs/rag-evals`)

A retrieval tool over a synthetic corpus of invented caller memories, with an eval suite and an honest experiment report.

**Provided:** `data/memories.jsonl` (about 300 invented memories from invented callers) and `data/queries_seed.jsonl` (20 labelled example queries), both synthetic. The learner extends the queries to at least 50 by labelling more themselves. A local embedding model is recommended (no API key, no cost); any model is allowed. Phase 14b must show that the re-m1 threshold is reachable with a simple keyword baseline on this data.

| Milestone | Weeks | Goal | Acceptance |
| --- | --- | --- | --- |
| re-m1 | 21 to 22 | Load the corpus into PostgreSQL with pgvector, plus a search command (`python search.py --query "..." --k 10 --mode vector` or `--mode hybrid`) that prints JSON results | Database check through `ATHENA_DATABASE_URL` (row count and one vector dimension); output matches the contract; for at least 80% of seed queries, a relevant id appears in the top 10 |
| re-m2 | 23 | Eval set of at least 50 labelled queries | Schema check passes; no duplicate queries; every relevant id exists in the corpus |
| re-m3 | 24 to 25 | Metrics command: `python metrics.py --run run.jsonl --qrels qrels.jsonl --seed 0` | JSON output with recall@5, recall@10 and MRR, each with a bootstrap 95% interval; passes the provided toy-data tests; same output for the same seed |
| re-m4 | 25 to 26 | One experiment | A report comparing the baseline with one change, with intervals and an honest conclusion (evidence link) |
| re-m5 | 26 | Eval gate in CI | CI fails if recall@10 drops more than a set margin below the baseline (evidence link) |
