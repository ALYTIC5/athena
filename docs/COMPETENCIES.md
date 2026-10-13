# Competencies: what the learner must know and be able to do

This is the source for `src/content/competencies.yaml`. Each competency has an id (used to tag lessons, exercises, questions and cards), what the learner must be able to **explain**, what they must be able to **do unaided**, and typical **interview questions**.

## Levels

| Level | Name | Meaning |
| --- | --- | --- |
| 0 | Not started | No evidence yet |
| 1 | Recognise | Can pick the right answer when shown options |
| 2 | Explain | Can explain it out loud, in their own words, with an example |
| 3 | Apply with help | Can do it with hints or documentation open |
| 4 | Apply unaided | Can do it alone, in interview conditions |
| 5 | Debug and teach | Can find and fix problems in other people's code and teach the idea |

**Core:** every competency in this file is core except the `ts.*` competencies and the electives.

**Targets:** level 4 on every core competency by week 28; level 5 on the competencies behind the two lab projects.

**Evidence types** (the rules for each level are in `docs/SPEC.md` section 13):

- **Browser** (the default): shown through browser exercises and mastery checks.
- **Interview** (`int.*`): shown through Interview Gym problems and drills.
- **Local** (`evidence: local` in `competencies.yaml`): shown through local work with an evidence link. These are all `git.*`, `wri.*`, `ops.*` and `sys.*` competencies, plus `sec.history`, `api.fastapi`, `eval.ci` and all `com.*` competencies.

Every competency a lesson tags must have at least 2 mastery items in that lesson (except the orientation lesson `start-00`, which has no mastery check).

Each track below shows the share of target postings that mention it (from the October 2026 analysis of 136 postings), where known.

---

## sec: security hygiene

| Id | Competency |
| --- | --- |
| sec.secrets | Keeping secrets out of code and repos |
| sec.history | Removing leaked secrets from git history |
| sec.least-privilege | Least privilege for keys, tokens and service accounts |
| sec.owasp-basics | Key risks from the OWASP Top 10:2025 |

**Explain:** why a secret pushed to a public repo must be treated as compromised even after deletion; rotate first, then purge; the difference between `.env` and `.env.example`; why API keys in client-side JavaScript are public; broken access control (A01), injection (A05) and authentication failures (A07) in plain terms, and what security misconfiguration (A02) and software supply chain failures (A03) mean; what least privilege means for an API key.

**Do unaided:** set up gitleaks as a pre-commit hook; write a `.gitignore` and `.env.example`; rotate a key and purge it from history with `git filter-repo`; scope a key to the minimum permissions.

**Interview questions:** "You pushed an API key to GitHub. What do you do, in order?" "How do you manage secrets in development, CI and production?" "What is SQL injection and how do you prevent it?"

---

## git: Git and GitHub as a team member

| Id | Competency |
| --- | --- |
| git.branching | Branches and a feature-branch workflow |
| git.pull-requests | Opening and reviewing pull requests |
| git.rebase-merge | Rebase versus merge, and resolving conflicts |
| git.undo | Undoing safely: revert, reset, restore |
| git.commits | Writing good commits and messages |

**Explain:** what a commit, a branch and HEAD are; merge versus rebase and when not to rebase (shared branches); revert versus reset; why small pull requests get better reviews; what a good review comment looks like.

**Do unaided:** create a branch, commit in small steps, push, open a pull request with a clear description, respond to review, rebase on main, resolve a merge conflict, revert a bad commit.

**Interview questions:** "Walk me through how you'd ship a small feature with a team." "What's the difference between `git merge` and `git rebase`?" "How do you undo a commit that's already been pushed?"

---

## wri: technical writing

| Id | Competency |
| --- | --- |
| wri.readme | READMEs that get a project understood in 2 minutes |
| wri.pr-description | Pull request descriptions |
| wri.design-note | One-page design notes |

**Explain:** what a README must answer (what, why, how to run, how to test, status, decisions); the parts of a design note (context, goals, non-goals, options, decision, risks).

**Do unaided:** write a README for a project; write a pull request description; write a one-page design note for a small service.

---

## py: Python (61% of target postings)

| Id | Competency |
| --- | --- |
| py.values-names | Names, objects and references |
| py.mutability | Mutable and immutable types; copying |
| py.control-flow | Conditions, loops, truthiness |
| py.functions | Defining and calling functions, return values, default arguments |
| py.collections | Lists, tuples, dicts and sets |
| py.comprehensions | Comprehensions and generator expressions |
| py.complexity | Big-O of common operations |
| py.scope-closures | Scope (LEGB) and closures |
| py.args-kwargs | `*args`, `**kwargs`, keyword-only arguments |
| py.decorators | Reading and writing simple decorators |
| py.iterators-generators | Iterators and generators |
| py.exceptions | Raising and handling exceptions |
| py.context-managers | `with` and context managers |
| py.files-json | Files, paths, JSON and CSV |
| py.datetime | Dates, times and time zones |
| py.classes | Classes, methods and dataclasses |
| py.typing | Type hints and checking them |
| py.packages | Modules, packages, virtual environments and dependencies |
| py.pytest | Testing with pytest |
| py.mocking | Fakes, stubs and mocks |
| py.async | async/await for I/O-bound work |

**Explain:** names point to objects, assignment never copies; why a mutable default argument is a bug; `==` versus `is`; list versus tuple versus set versus dict and the cost of membership tests (list O(n), set and dict O(1) on average); dicts keep insertion order; shallow versus deep copy; LEGB scope and the late-binding closure trap; what `yield` does and why generators save memory; EAFP versus LBYL; what a context manager guarantees; naive versus time-zone-aware datetimes; that type hints are not enforced at runtime; why you use a virtual environment and pin dependencies; what a fixture and parametrisation are; fake versus mock; when async helps (waiting on I/O) and when it doesn't (CPU-bound work).

**Do unaided (30 to 45 minutes each):** parse a JSON or CSV file and aggregate it with dicts and `collections`; write a function with edge cases and tests; refactor repeated code into functions; read a traceback and fix the bug; write a dataclass with methods and type hints; write a generator; write a retry decorator; write pytest tests with fixtures and `parametrize`; replace a network call with a fake in a test; write an async function that makes several requests concurrently with a timeout.

**Interview questions:** "What happens when you pass a list to a function and the function appends to it?" "Why is `x in my_set` faster than `x in my_list`?" "What does `yield` do?" "Explain a decorator you've written." "How do you handle errors in code that calls an external API?" "How do you test code that calls an LLM?"

---

## sql: SQL and PostgreSQL (37%)

| Id | Competency |
| --- | --- |
| sql.select | Selecting, filtering, sorting and limiting |
| sql.joins | Inner, left and self joins |
| sql.aggregation | GROUP BY, HAVING and aggregates |
| sql.subqueries-ctes | Subqueries and common table expressions |
| sql.window | Window functions (ROW_NUMBER, running totals) |
| sql.nulls | NULL behaviour |
| sql.schema | Schema design, keys and constraints |
| sql.normalisation | Normalisation and when to denormalise |
| sql.indexes | Indexes and reading EXPLAIN |
| sql.transactions | Transactions, ACID and isolation |
| sql.locking-queues | Row locking and job queues with `FOR UPDATE SKIP LOCKED` |
| sql.migrations | Migrations |
| sql.parameters | Parameterised queries and SQL injection |
| sql.jsonb | JSONB basics |

**Explain:** primary and foreign keys; INNER versus LEFT JOIN; why `= NULL` never matches; WHERE versus HAVING; what an index costs (slower writes, storage) as well as what it buys; what EXPLAIN shows and that EXPLAIN ANALYZE actually runs the query; the four ACID properties in plain words; PostgreSQL's default isolation (READ COMMITTED); how `SKIP LOCKED` lets several workers take jobs without blocking each other; why queries must be parameterised.

**Do unaided:** write joins, aggregates, CTEs and a window function; find duplicates; design a schema for bookings (customers, slots, bookings, calls) with constraints; add an index and show the plan change; write a migration; query PostgreSQL from Python with parameters.

**Interview questions:** "INNER versus LEFT JOIN?" "How would you find duplicate bookings?" "What's an index and what does it cost?" "What is a transaction?" "How would you build a job queue in PostgreSQL?"

---

## api: HTTP, REST APIs and webhooks (54%)

| Id | Competency |
| --- | --- |
| api.http | HTTP requests and responses |
| api.methods | Methods, safety and idempotency |
| api.status-codes | Status codes |
| api.rest-design | Resource design, pagination and versioning |
| api.auth | Authentication versus authorisation; API keys, OAuth 2.0 and JWT basics |
| api.fastapi | Building APIs with FastAPI and Pydantic |
| api.client | Calling APIs with httpx: timeouts, retries, errors |
| api.webhooks | Receiving webhooks and verifying signatures |
| api.idempotency | Idempotency keys and duplicate events |
| api.retries | Retries with exponential backoff and jitter |
| api.rate-limits | Rate limits and 429 handling |

**Explain:** the parts of a request and a response; which methods are idempotent (GET, HEAD, OPTIONS, PUT, DELETE) and which aren't guaranteed to be (POST, PATCH); 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500 and 503; 401 versus 403; PUT versus PATCH; that webhooks are usually delivered at least once, so handlers must tolerate duplicates; that signatures are typically an HMAC over the raw request body (often with a timestamp to stop replays), compared in constant time, and that every provider's exact scheme differs; why retries need backoff and jitter; why every outbound call needs a timeout.

**Do unaided:** build a FastAPI service with validated request bodies, proper status codes and tests; call an external API with timeouts and retries; verify a webhook signature with `hmac.compare_digest`; make a handler idempotent using an event id; document an API with OpenAPI.

**Interview questions:** "401 versus 403?" "A provider sends the same webhook twice. What happens in your system?" "How do you check a webhook really came from the provider?" "How would you design an endpoint to create a booking?"

---

## ai: LLM APIs, agents and prompting (agents 38%, LLM APIs 32%, prompting 29%)

| Id | Competency |
| --- | --- |
| ai.llm-basics | Tokens, context windows, sampling and roles |
| ai.structured-output | Structured output validated with Pydantic |
| ai.streaming | Streaming responses |
| ai.providers | Calling more than one provider behind one interface |
| ai.prompting | Writing and iterating prompts against a test set |
| ai.tool-calling | Tool calling |
| ai.agent-loop | The agent loop: steps, state and stop conditions |
| ai.guardrails | Guardrails, allowlists and human hand-off |
| ai.prompt-injection | Prompt injection and mitigations |
| ai.cost-latency | Cost and latency |
| ai.workflow-vs-agent | When to use a fixed workflow and when an agent |
| ai.testing | Testing LLM code with fakes |

**Explain:** what tokens and context windows are and how they drive cost; what temperature changes; system versus user messages; how tool calling works (the model asks for a tool call, your code runs it, you return the result, and the loop continues until the model answers or a limit is hit); why you validate tool arguments and limit steps; direct versus indirect prompt injection and why it can be reduced but not fully prevented; how to cut cost (smaller models, shorter prompts, caching, fewer calls); when a deterministic workflow beats an agent; why you test LLM code with a fake model.

**Do unaided:** call Claude and one other provider through one small interface; get structured output and validate it; write an agent loop by hand with two or three tools and a step limit; add guardrails (argument validation, an allowlist, human approval for irreversible actions); measure tokens and cost per request; test it all with a scripted fake model.

**Interview questions:** "Walk me through how tool calling works." "How do you stop an agent doing something harmful?" "What is prompt injection and what do you do about it?" "How would you halve the cost of this LLM feature?" "When would you not use an agent?"

---

## ops: Docker, CI, cloud and observability (cloud 35%, CI/CD 19%, Docker 18%, testing 18%)

| Id | Competency |
| --- | --- |
| ops.containers | Images, containers and Dockerfiles |
| ops.compose | Docker Compose for local development |
| ops.ci | CI pipelines in GitHub Actions |
| ops.test-pyramid | The test pyramid |
| ops.secrets-ci | Secrets in CI and production |
| ops.deploy | Deploying a container to a cloud service |
| ops.iam | Cloud identity and least privilege |
| ops.environments | Development, staging and production |
| ops.logging | Structured logging |
| ops.tracing-metrics | Traces, metrics and LLM cost tracking |
| ops.rollback | Rollbacks and safe releases |

**Explain:** image versus container; layer caching; why secrets never go in images; what each CI stage proves; unit versus integration versus end-to-end tests; why development and production must not share a database; what a managed container service does (scaling, revisions, logs); how to roll back.

**Do unaided:** write a Dockerfile and a Compose file for an app plus PostgreSQL; write a GitHub Actions workflow for lint, type checks and tests; deploy a container to Google Cloud Run with secrets from Secret Manager; find a failure in the logs and roll back.

**Interview questions:** "What happens when you run `docker build`?" "How do you handle secrets in CI?" "How do you deploy without downtime?" "Something breaks in production after a deploy. What do you do?"

---

## rag: retrieval and evals (RAG 27%, evals 20%)

| Id | Competency |
| --- | --- |
| rag.embeddings | Embeddings and similarity |
| rag.chunking | Chunking |
| rag.pgvector | Storing and searching vectors in pgvector |
| rag.hybrid | Hybrid search (keyword plus vector) |
| rag.rerank | Re-ranking |
| rag.context | Building context and citing sources |
| eval.datasets | Building a labelled eval set |
| eval.retrieval-metrics | Recall@k, precision@k and MRR |
| eval.answer-quality | Judging answer quality, including LLM-as-judge and its biases |
| eval.experiments | Running experiments and reporting honestly |
| eval.ci | Evals in CI as regression gates |
| eval.privacy | Keeping personal data out of eval sets |

**Explain:** what an embedding is; cosine similarity; that queries and documents must use the same embedding model; chunk size trade-offs; pgvector's distance operators and index types (HNSW, IVFFlat) at a high level; why you evaluate retrieval separately from generation; what recall@k and MRR measure; the known biases of LLM judges (position, length, self-preference); why small eval sets give uncertain results.

**Do unaided:** embed and store documents in pgvector and query them; build a labelled eval set of at least 50 queries; compute recall@k and MRR; run an experiment changing one variable and report the result with its uncertainty; add the eval to CI with a threshold.

**Interview questions:** "How do you know your RAG system works?" "Retrieval returns the wrong documents. How do you debug it?" "What are the risks of using an LLM as a judge?" "How would you choose a chunk size?"

---

## com: communication (English 59%, client-facing 26%)

| Id | Competency |
| --- | --- |
| com.clarifying | Asking clarifying questions before building |
| com.tradeoffs | Explaining trade-offs |
| com.client | Explaining technical decisions to non-technical people |
| com.star | Behavioural answers with STAR |
| com.project-story | Telling a 2-minute project story |

**Explain and do:** ask clarifying questions before coding; explain a decision as options, choice and trade-off; explain a technical issue to a business owner without jargon; tell six STAR stories; give a 2-minute and a 10-minute account of each lab project and of past projects, honestly separating your own work from what tools or teammates produced.

---

## int: interview fundamentals

| Id | Competency |
| --- | --- |
| int.approach | A repeatable approach: clarify, examples, brute force, optimise, code, test, complexity |
| int.big-o | Big-O analysis |
| int.hashing | Arrays and hashing |
| int.two-pointers | Two pointers |
| int.sliding-window | Sliding window |
| int.stack | Stacks |
| int.binary-search | Binary search |
| int.recursion | Recursion |
| int.trees | Trees with DFS and BFS |
| int.heaps | Heaps |
| int.graphs | Graphs with BFS and DFS |
| int.intervals | Sorting and intervals |
| int.code-reading | Reading and fixing unfamiliar code |
| int.ai-assisted | Using an AI assistant in an interview while staying in control |

**Do unaided:** solve easy problems in 20 minutes and most mediums in 40, talking throughout; state time and space complexity; read 100 to 200 lines of unfamiliar code and fix a bug in 30 minutes; use an AI assistant on a task while stating hypotheses and verifying output with tests.

---

## sys: system design basics

| Id | Competency |
| --- | --- |
| sys.components | Clients, APIs, workers, queues, databases and caches |
| sys.scaling | Scaling basics: stateless services, horizontal scaling, rate limits |
| sys.failure | Failure modes: timeouts, retries, idempotency, dead-letter queues |
| sys.tradeoffs | Making and stating design trade-offs |

**Do unaided:** sketch a small system end to end (for example, webhook ingestion to queue to worker to LLM to database) with its data model, API and failure handling, and explain the trade-offs in 20 minutes.

---

## ts: TypeScript and React (not core; TypeScript 29%, JavaScript or TypeScript 46%, React 18%)

| Id | Competency |
| --- | --- |
| ts.types | TypeScript types, unions and narrowing |
| ts.react | React components, props, state and effects |

**Do:** read and explain the learner's own TypeScript code; write one small typed function and one small component unaided, with a test.

---

## Electives (taught only when a target job asks for them)

| Id | Competency |
| --- | --- |
| el.mcp | Building a small MCP server |
| el.frameworks | LangChain or similar versus a hand-written agent loop |
| el.finetuning | What fine-tuning is, when it helps and when it doesn't |
| el.workflow-to-code | Moving an n8n workflow into tested Python |
| el.aws | Deploying the same service on AWS |
