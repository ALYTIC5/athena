# Teaching rules

Every lesson, exercise, question and card in Athena follows these rules. They come from the learning techniques with the strongest evidence: retrieval practice, spaced practice, interleaving, worked examples with fading, PRIMM, Parsons problems and self-explanation. Where a rule is a design choice rather than research, it says so.

## 1. Who you are teaching

Read `private/LEARNER.md` (local only). Never quote, paraphrase or summarise it in any committed file, page or commit message. In public files, call the reader "the learner".

What this means for content:

- Connect new ideas to the job domains in section 9, using invented data.
- Make unaided practice the default.
- Keep lessons focused. The learner has about 2.75 hours a week for lessons and lab work, in two sessions, plus 15 minutes of review.

## 2. Lesson anatomy (in this order)

This is the full anatomy, for lessons of 2 hours or more. Shorter lessons use the short anatomy at the end of this section. The orientation lesson `start-00` is exempt: it has no warm-up, mastery check or cards.

1. **Warm-up (about 8 minutes):** `<WarmUp>` draws 5 retrieval items from earlier published lessons, weighted towards weak competencies. Skip it when fewer than 5 earlier items exist.
2. **Why this matters (2 to 4 sentences):** tie the topic to the job postings (use the percentages in `docs/CURRICULUM.md`) and to the kind of work the learner does.
3. **Objectives (3 to 5):** each starts with a measurable verb, for example explain, predict, write, debug, compare, design or measure. Every objective must be assessed by at least one mastery item.
4. **Concept chunks (2, or 3 if the time estimate allows).** Each chunk has:
   - an explanation of at most 200 words, with jargon defined at first use
   - a worked example with line-by-line annotations
   - a **predict-then-run** cell (PRIMM): predict the output and your confidence, run it, then answer 1 or 2 "investigate" questions (what happens if…, why does line 3…)
   - a **faded example**: the same pattern with key lines blanked out for the learner to fill in
   - a quick check: 1 or 2 questions with explanations
   - a "common misconceptions" callout listing 1 to 3 real misconceptions
5. **Parsons problem:** for any new syntax or structure, with 1 or 2 distractor lines.
6. **Debug exercise:** realistic code with one planted bug and a failing test. The learner finds and fixes it.
7. **Make exercise:** a new problem using the lesson's ideas, with hidden tests and the three-step hint ladder. Banner: "Write this yourself. Claude can be your tutor (use the 'I'm stuck' button) but not your author."
8. **Explain-back:** the `<ExplainBack>` component, using the learner's make-exercise code.
9. **Mastery check:** `<MasteryCheck>` with 8 to 12 questions (at least 30% from earlier published lessons once they supply 8 or more mastery items) plus one mastery make exercise that is different from the lesson's own. 80% to pass.
10. **Interview corner:** 2 to 4 questions an interviewer would ask about this topic. The learner answers first; the model answer and "what the interviewer listens for" are revealed afterwards.
11. **Use it in your project:** where relevant, the concrete next step on the current lab milestone.
12. **Further reading:** 1 to 3 links to official documentation only.

In lessons of 2 hours or more, mark the midpoint with `<SessionBreak />` so the lesson splits into two sessions.

**Short anatomy (lessons under 2 hours):** a warm-up only if this is the first lesson of its week; why this matters; objectives (2 to 4); 1 or 2 concept chunks (the faded example is optional); one or two debug or make exercises if the time estimate allows, or for SQL a set of short query exercises; a mastery check of 6 to 8 questions plus one mastery make exercise (which may be short); and 2 or 3 interview-corner questions (optional for lessons of 60 minutes or less). Explain-back is optional. No session break.

**Fitting the time:** the validator estimates each lesson's time from its contents (`docs/CONTENT_GUIDE.md` section 8). If a lesson runs over its target, cut content (fewer check items, fewer interview questions, a smaller make exercise) rather than raising the target: the weekly cap is fixed. Two-hour full lessons use one check question per chunk and the shorter defaults in that table.

**Local lessons:** some skills can't run in the browser (Git, Docker, cloud deploys, FastAPI servers). Teach the concepts with browser exercises as usual, and give local practice as a `<Checklist>` with exact commands and what the learner should see. Checklists and rubrics are self-assessed and never count as unaided evidence.

## 3. Cognitive load (worked examples and fading)

- One new idea per chunk. Concrete example first, then the general rule.
- Paragraphs of at most 4 sentences. Code examples in concept chunks of at most 20 lines.
- Put explanations next to the code they explain (annotations or comments), never pages apart.
- Move from worked example, to faded example, to full problem. Remove support as the learner progresses through the course: early lessons fade slowly, later lessons start with problems sooner.
- For topics the learner already knows in practice (decide from `private/LEARNER.md`; never say why on the page), mark the chunk `prior: true`: it opens with a problem, and the worked example is available afterwards for checking. Explaining what someone already knows slows them down (the expertise reversal effect).

## 4. Feedback and hints

- Feedback is immediate and specific. Never just "Wrong". Name the likely misconception and point to where it is taught.
- Every multiple-choice option has an explanation, including the correct one.
- **Hint ladder:** (1) a question that points at the problem, (2) the strategy in words, (3) a near-solution with blanks. Each hint reduces credit, and using the tutor prompt caps credit at 0.75 (see `docs/SPEC.md`), so unaided work is always visible.
- Solutions unlock only after a pass or a genuine attempt (three failed checks plus all hints). The solution comes with an explanation of why it works and at least one alternative approach with its trade-off.
- Tone: direct, warm, adult. Praise the strategy, not the person. No hype, no emojis, no exclamation marks.

## 5. Retrieval, spacing and interleaving

- Every lesson produces 8 to 15 cards. Rules for cards:
  - one fact or skill per card
  - prefer "why" and "what happens if" over definitions
  - use predict cards (code with an auto-checked output) for code behaviour
  - write explain cards for concepts the learner must be able to say out loud in interviews
  - never write a card that can be answered by recognising the wording
- Warm-ups and mastery checks include items from earlier lessons (at least 30% once earlier published lessons supply 8 or more mastery items).
- In the Interview Gym, the weekly focus names its pattern, but mixed sets hide pattern labels until after the attempt.

## 6. Self-explanation and calibration

- The lesson's main make exercise ends with explain-back (optional in short lessons; never after mastery make exercises).
- Investigate questions ask "why" and "what if", not "what".
- Graded questions and predict cells ask for confidence before the answer is checked.

## 7. Mastery (design choice)

- A lesson is mastered at 80% or more on its mastery check, with the make exercise passed unaided.
- On a fail, route the learner to the chunks tagged with the missed competencies, then offer a retake with different items.

## 8. Desirable difficulty

- Let the learner struggle productively, but not for too long: after about 15 minutes stuck on an exercise, the page suggests the first hint or the tutor prompt.
- Ask for predictions and attempts before showing answers.
- Vary the surface details of examples (different domains, names and data) so the learner learns the idea, not the example.

## 9. Real-world tasks (design choice)

- Use the domains of the jobs the learner wants: bookings and appointments, phone calls and transcripts, webhooks from telephony and payment providers, CRM records, invoices, support tickets, job queues, memory retrieval.
- Use invented names and data only. Use a range of names from different cultures.
- Prefer small, realistic programs over toy puzzles, except in the Interview Gym.

## 10. Accuracy and honesty

- Check every technical claim against official documentation and link the page you used in "Further reading" or the lesson's `sources`.
- Say when something depends on version or provider (for example, how a webhook provider signs requests).
- Teach current best practice, and say when practice varies between teams.
- Don't overclaim. For example, prompt injection cannot be fully prevented; say so and teach mitigations.

## 11. Writing style

- Plain international English. Short sentences. Define jargon at first use.
- Second person ("you").
- Headings in sentence case.
- Code targets the Python version Pyodide ships (3.14 at the time of writing; check in phase 0) and follows PEP 8. Use type hints from py-05 onwards (simple hints earlier are fine). Where 3.14 behaviour differs from older versions in a way the learner may meet at work (for example `except A, B:` without parentheses, warnings for `return` in `finally`, lazily evaluated annotations), say so.
- Every image has alt text, and colour never carries meaning alone.
