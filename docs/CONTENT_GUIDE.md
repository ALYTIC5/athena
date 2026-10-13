# Content guide: formats, validation and the quality bar

Read `docs/TEACHING.md` first: it says what to teach and how. This file says how to write it down so it can be validated, and what "good enough to publish" means.

## 1. Where content lives

| Content | Location | Format |
| --- | --- | --- |
| Lesson pages | `src/content/docs/lessons/<lesson-id>.mdx` (order set with `sidebar.order`, so moving a lesson never changes its URL) | MDX with frontmatter |
| Exercises | `src/content/exercises/<exercise-id>.yaml` | YAML |
| Question pools | `src/content/quizzes/<lesson-id>.yaml` | YAML |
| Checklists and rubrics | `src/content/practice/<id>.yaml` | YAML |
| Cards | `src/content/cards/<lesson-id>.yaml` | YAML |
| Interview corner | `src/content/interview/<lesson-id>.yaml` | YAML |
| Gym problems | `src/content/problems/<problem-id>.yaml` | YAML |
| Drills | `src/content/drills/<drill-id>.yaml` | YAML |
| Weekly plan | `src/content/curriculum.yaml`: a list of week objects, each with `id`, `lessons` (each with `id`, `title`, `durationMin` and `status: planned` or `published`), `lab` (milestone ids and minutes) and `gym` (focus and target) | YAML |
| Competencies | `src/content/competencies.yaml` (a list of objects with `id`, `track`, `title`, `evidence`) | YAML |

Ids are lowercase with hyphens. A file's name must equal its `id` (the glob loader takes ids from file paths, and the validator checks they match). Exercise, question, card and practice ids start with their lesson id (for example `py-01-make-reschedule`).

## 2. Lesson frontmatter

The fields below are added to Starlight's docs schema with `docsSchema({ extend })`. They must be optional in the schema (other docs pages don't have them), and the validator requires them for every page under `lessons/`.

```yaml
title: "Names, values and mutability"
sidebar:
  order: 30
lessonId: py-01
week: 3
track: py
durationMin: 165
anatomy: full                 # full | short | orientation
competencies: [py.values-names, py.mutability, py.control-flow, py.functions]
prerequisites: [start-00]
whyItMatters: >
  Python appears in 61% of the postings you're targeting...
objectives:
  - Explain that names refer to objects and assignment never copies
  - Predict the effect of mutating a list passed to a function
sources:
  - title: "The Python Tutorial: More on lists"
    url: https://docs.python.org/3/tutorial/datastructures.html
```

## 3. Components in lessons

Content components are `.astro` wrappers (see `docs/SPEC.md` section 5), available in every lesson through auto-import. A typical full lesson:

```mdx
<WarmUp lesson="py-01" count={5} />

<Chunk n={1} title="Names point to objects">
  …explanation and worked example…
  <Predict lesson="py-01" item="py-01-q-aliasing-predict" />
  <Exercise id="py-01-faded-copy" />
  <Quiz lesson="py-01" chunk={1} />
  <Callout type="misconception">…</Callout>
</Chunk>

<Parsons lesson="py-01" item="py-01-q-parsons-filter" />
<SessionBreak />
<Exercise id="py-01-debug-shared-default" />
<Exercise id="py-01-make-reschedule" />
<ExplainBack lesson="py-01" exercise="py-01-make-reschedule" />
<MasteryCheck lesson="py-01" count={8} />
<InterviewCorner lesson="py-01" />
```

Lessons with a "Use it in your project" step add `<LabStep milestone="wa-m1" />` (sql-04 in this case); it shows "coming soon" until the milestone page exists.

- `<Chunk>` renders the chunk heading with the anchor `chunk-<n>`, which remedial routing links to. Add `prior` for chunks that open with a problem (see `docs/TEACHING.md` section 3).
- `<Quiz lesson chunk>` draws only items tagged with that chunk.
- `<Checklist id>` and `<Rubric id>` render items from `src/content/practice/`.

**Code blocks in lesson prose:** the validator runs every `python` and `sql` block. A `sql` block needs `schema="<exercise-id>"` naming the exercise whose schema it runs against. Mark a block that must not run (for example, it shows an error on purpose, or it needs a network) with `nocheck` and a reason: ` ```python nocheck="needs network" `. Other languages are not run.

## 4. Exercise files

```yaml
id: py-01-make-reschedule
lesson: py-01
runtime: python              # python | sql
kind: make                   # faded | debug | make | write-tests
pools: [lesson]              # lesson (shown in the lesson) and/or mastery (drawn by the mastery check)
title: Reschedule a booking without changing the original list
difficulty: 2                # 1 (easy) to 5 (hard)
competencies: [py.mutability, py.functions]
timeoutMs: 5000
packages: []                 # extra Pyodide packages, for example [numpy], [tzdata], [pytest], [pyyaml]
prompt: |
  Markdown. State the task, the inputs and outputs, and one example.
starter: |
  def reschedule(bookings: list[dict], booking_id: str, new_slot: str) -> list[dict]:
      ...
visibleTests: |
  def test_moves_the_booking():
      ...
hiddenTests: |
  def test_input_unchanged():
      ...
  def test_unknown_id_raises():
      ...
feedback:
  - test: test_input_unchanged
    message: "Your function changed the list it was given. Build a new list instead."
hints:
  - "What happens to the caller's list if you change a dict inside it?"
  - "Copy each booking you change, and build a new list as you go."
  - "result = []\nfor b in bookings:\n    if b['id'] == booking_id:\n        result.append({**b, 'slot': ____})\n    else:\n        result.append(____)"
referenceSolution: |
  ...
wrongSolutions:              # at least 2, each a real misconception; each must fail at least one test
  - label: "Mutates the original booking dict"
    code: |
      ...
  - label: "Returns the input list itself"
    code: |
      ...
explanation: |
  Why the reference works, its complexity, and one alternative with its trade-off.
```

- **debug:** `starter` contains the bug, and the visible tests include one that fails until it is fixed.
- **write-tests:** instead of tests, give `implementations: { correct: <code>, buggy: [{ label, code }, ...] }` with at least 3 buggy versions. `referenceSolution` is a test file that passes on `correct` and fails on every buggy version. `wrongSolutions` are test files that miss at least one buggy version. Use `packages: [pytest]`.
- **Gap-fills in other formats** (for example a GitHub Actions workflow in YAML) are `make` exercises whose tests parse the learner's text and check it (`packages: [pyyaml]`).
- Each lesson needs at least two exercises with `pools: [mastery]` and `kind: make`, different from the lesson's own make exercise.
- Predict items and Parsons problems are question items (section 5), not exercises.

### SQL exercises

```yaml
id: sql-02-make-no-bookings
lesson: sql-02
runtime: sql
kind: make
pools: [lesson]
competencies: [sql.joins, sql.nulls]
extensions: []               # for example [vector]
schema: |
  CREATE TABLE customers (...);
  INSERT INTO customers VALUES (...);
prompt: |
  List customers who have never made a booking, ordered by name.
starter: |
  SELECT ...
referenceSolution: |
  SELECT c.name FROM customers c LEFT JOIN bookings b ON b.customer_id = c.id WHERE b.id IS NULL ORDER BY c.name;
compare:                     # or `compare: none` for DDL exercises graded only by checks
  orderMatters: true
  numericTolerance: 0.001
checks: []                   # each is a query returning one true, or { sql, expectError: "23505" }
wrongSolutions:
  - label: "Inner join returns only customers with bookings"
    code: |
      SELECT c.name FROM customers c JOIN bookings b ON b.customer_id = c.id ORDER BY c.name;
  - label: "Uses = NULL instead of IS NULL"
    code: |
      SELECT c.name FROM customers c LEFT JOIN bookings b ON b.customer_id = c.id WHERE b.id = NULL ORDER BY c.name;
hints: [...]
explanation: |
  ...
```

## 5. Question pools

```yaml
lesson: py-01
items:
  - id: py-01-q-aliasing
    pools: [check, mastery, warmup]
    chunk: 1                   # which chunk's quick check this belongs to
    objective: 1               # which objective (1-based) a mastery item assesses
    type: single               # single | multiple | short | predict | parsons | bug | order
    competencies: [py.values-names]
    stem: "After running this code, what is `a`?"
    code: |
      a = [1, 2]
      b = a
      b.append(3)
    options:
      - text: "[1, 2]"
        correct: false
        why: "This assumes `b = a` made a copy. Assignment never copies; both names refer to the same list."
      - text: "[1, 2, 3]"
        correct: true
        why: "`a` and `b` are two names for one list object, so appending through `b` changes what `a` shows."
  - id: py-01-q-aliasing-predict
    pools: [check, mastery]
    chunk: 1
    objective: 2
    type: predict
    competencies: [py.functions, py.mutability]
    code: |
      def add(item, items=[]):
          items.append(item)
          return items
      add(1)
      print(add(2))
    investigate:
      - "Why does the second call print two items?"
    # No expected output here: the validator runs the code at build time and stores the result.
  - id: py-01-q-parsons-filter
    pools: [check]
    chunk: 2
    type: parsons
    competencies: [py.functions, py.control-flow]
    lines: ["def upcoming(bookings, today):", "    result = []", "    for b in bookings:", "        if b['date'] >= today:", "            result.append(b)", "    return result"]
    distractors: ["    bookings.remove(b)"]
```

**Pool minimums per lesson:** at least 2 check items per chunk; at least twice as many mastery questions as the largest check draws (24 for full lessons, 16 for short ones), with every objective covered; at least 6 warm-up-eligible items (10 for full lessons). The orientation lesson has none of these.

### Checklists and rubrics

```yaml
# practice/git-01-checklist-practice-repo.yaml
id: git-01-checklist-practice-repo
lesson: git-01
kind: checklist                 # checklist | rubric
competencies: [git.branching, git.rebase-merge]
title: Practise a feature branch and a conflict locally
steps:
  - do: "git switch -c add-greeting"
    expect: "Switched to a new branch 'add-greeting'"
# A rubric uses `criteria: [{ name, levels: [ { score, description } ] }]` instead of steps.
```

## 6. Cards and interview corner

```yaml
# cards/py-01.yaml
lesson: py-01
cards:
  - id: py-01-c-default-arg
    type: explain              # basic | cloze | predict | explain
    competencies: [py.functions, py.mutability]
    front: "Why is `def f(x, items=[])` a bug?"
    back: "The default list is created once, when the function is defined, so every call that uses the default shares and mutates the same list. Use `items=None` and create a new list inside."
```

```yaml
# interview/py-01.yaml
lesson: py-01
questions:
  - id: py-01-iq-pass-list
    competencies: [py.values-names, py.mutability]
    question: "What happens when you pass a list to a function and the function appends to it?"
    modelAnswer: "..."
    listenFor: ["names refer to objects", "no copy is made", "the caller sees the change", "how to avoid it if unwanted"]
```

## 7. Gym problems and drills

```yaml
id: gym-hash-01
title: First repeated caller
pattern: hashing               # shown in the weekly focus; hidden in mixed sets until after the attempt
competencies: [int.hashing]
difficulty: easy               # easy | medium
timeLimitMin: 20
statement: |
  ...
examples: [...]
constraints: [...]
starter: |
  ...
visibleTests: | ...
hiddenTests: | ...
referenceSolutions:
  - code: | ...
    time: "O(n)"
    space: "O(n)"
wrongSolutions: [...]          # at least 2
patternExplanation: |
  ...
commonMistakes: [...]
followUps: ["What if the list doesn't fit in memory?", "..."]
```

Drills add `files` (a map of file name to code), a `failingTest`, and a hidden `bugExplanation`. Their reference solution is the fixed set of files.

## 8. What `npm run validate` checks

1. **Schemas and references:** every file matches its Zod schema; ids are unique and equal their file names; references resolve (lesson to exercise, item to competency, lab step to a milestone id listed in `curriculum.yaml`). A published lesson must not reference content of a planned lesson, except in `prerequisites`, which may name any lesson in `curriculum.yaml`. Content belonging to planned lessons (including the platform phases' sample exercises) is schema-checked and graded but not rendered. A published lesson's frontmatter `durationMin` must equal its value in `curriculum.yaml`.
2. **Graders:** every Python and SQL reference solution passes all its tests, run with the same graders the browser uses (Pyodide and PGlite under Node, see `docs/SPEC.md` section 6). Every wrong solution fails at least one test; if one passes, the tests are too weak. Write-tests exercises are checked against their correct and buggy implementations.
3. **Predict items and code blocks:** every predict item and every `python` or `sql` lesson block runs (unless marked `nocheck` with a reason). The validator stores each predict item's output as its ground truth. It runs each item in two fresh interpreters, with different hash seeds and with `TZ=UTC` and `TZ=Pacific/Kiritimati`, and rejects output that differs.
4. **Coverage:** every objective is assessed by at least one mastery item (`objective` field); every competency a lesson tags has at least 2 mastery items; pool minimums (section 5) are met; each lesson has at least two mastery make exercises. The orientation lesson is exempt.
5. **Interleaving:** once earlier published lessons supply 8 or more mastery items, a check can draw at least 30% of its questions from them.
6. **Time:** the validator estimates each lesson's time from what the learner sees, not from the pools: the warm-up, each chunk, the items each `<Quiz>` shows, every exercise and practice item on the page, the mastery check's `count` of questions (default 8 for full lessons and 6 for short ones) plus one mastery make exercise, and the interview-corner questions. It uses the defaults below (any exercise or practice item may override its default with `estMin`, for example a 3-minute SQL query; in `start-00` every item sets `estMin`) and fails if the estimate exceeds `durationMin` by more than 15%. Each week's lessons plus lab minutes (from `curriculum.yaml`) must be at most 2.75 hours.

   | Item | Full lessons over 2 hours | Full lessons of 2 hours | Short lessons |
   | --- | --- | --- | --- |
   | Warm-up | 8 | 8 | 8 (only if first in its week) |
   | Concept chunk (reading and worked example) | 10 | 10 | 10 |
   | Check question or predict item | 2 | 2 | 2 |
   | Faded exercise | 8 | 8 | 8 |
   | Parsons problem | 5 | 5 | 5 |
   | Debug exercise | 15 | 15 | 15 |
   | Make or write-tests exercise | 30 | 20 | 20 |
   | SQL query exercise | 3 | 3 | 3 |
   | Explain-back | 15 | 10 | 10 |
   | Mastery question | 1.5 each | 1.5 each | 1.5 each |
   | Mastery make exercise | 25 | 15 | 15 |
   | Interview-corner question | 4 each | 4 each | 4 each |
   | Checklist step | 3 each | 3 each | 3 each |
   | Rubric | 10 | 10 | 10 |

   With these defaults, py-01 (2 chunks with 2 check questions each, a Parsons problem, debug, make, explain-back, 8 mastery questions plus a mastery make, and 2 interview questions) comes to about 166 minutes against its 165-minute target, and the smallest 2-hour full lesson (one check question per chunk) to about 137 minutes against a 138-minute ceiling.

7. **Links:** internal links resolve (starlight-links-validator). External links are checked with a warning only.
8. **Safety:** no secrets (gitleaks; synthetic secrets must contain `ATHENA_FAKE`); phone numbers only from the reserved fictional ranges in `CLAUDE.md`; email addresses only at example.com, example.org, example.net or .test.

## 9. The quality checklist (for authors and reviewer subagents)

A lesson is publishable only when every answer is yes.

**Teaching**

- [ ] The lesson follows the full or short anatomy in `docs/TEACHING.md` section 2, in order, with a session break near the middle of full lessons.
- [ ] Objectives use measurable verbs, and each is assessed by mastery items.
- [ ] Each chunk has an explanation (200 words or fewer), a worked example, a predict-then-run item with investigate questions, a faded example, a quick check and misconceptions.
- [ ] The make exercise is new (not a copy of a worked example) and needs the lesson's ideas; the mastery make exercises are different again.
- [ ] Examples use the learner's domains with invented data.
- [ ] Nothing is used before it is taught (check the curriculum order).

**Correctness**

- [ ] `npm run validate` passes.
- [ ] Every technical claim matches the official documentation, and the lesson links to the pages used.
- [ ] Hidden tests cover edge cases: empty input, one item, duplicates, invalid input and large input where relevant.
- [ ] Wrong solutions represent real misconceptions, and their feedback messages name them.
- [ ] Multiple-choice distractors are plausible, and every option has an explanation.
- [ ] Exercises don't depend on the host time zone, the current time, threads, subprocesses, sockets or `input()`.
- [ ] Nothing is copied from another source, and nothing from `private/` appears anywhere.

**Clarity and accessibility**

- [ ] Plain English, short sentences, jargon defined at first use.
- [ ] Headings form a correct hierarchy; images have alt text; colour is never the only signal.
- [ ] The time estimate is realistic for a learner at this level.

## 10. Review procedure

After drafting a lesson:

1. Run `npm run validate` and fix everything.
2. Start a fresh reviewer subagent with no knowledge of how the lesson was written. Give it this file, `docs/TEACHING.md`, the lesson and its content files. Ask it to check every item in section 9, verify technical claims against official documentation, try each exercise as a learner would, and return a numbered list of issues with severity (blocker, major, minor).
3. Fix every blocker and major issue, and minor ones where quick. Repeat until the reviewer finds nothing above minor, for at most three rounds; then list what remains in the pull request.
4. Commit the lesson on its own: `content(py-01): names, values and mutability`.
