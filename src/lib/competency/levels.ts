import { passedWithinLimit } from '../gym/attempts';
import { hasRecentLapses } from '../srs/lapses';
import { toLocalDate, type LearnerData } from '../store/store';
import type { CompetencyDef, CompetencyResult, ContentIndex } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const RUSTY_OVERDUE_DAYS = 14;
export const OVERCONFIDENT_DAYS = 30;

type Level = CompetencyResult['level'];

const has = (list: readonly string[], id: string) => list.includes(id);

function unaidedExercise(a: LearnerData['exercises'][string]['attempts'][number]): boolean {
  return a.passed && a.hintsUsed === 0 && !a.tutorUsed && !a.solutionViewed;
}

function masteryPassed(data: LearnerData, lesson: string): boolean {
  return data.lessons[lesson]?.masteryAttempts.some((m) => m.passed) ?? false;
}

function sessionsFor(data: LearnerData, id: string) {
  return data.sessions.filter((s) => has(s.competencies, id));
}

function allScoresAtLeast(s: LearnerData['sessions'][number], min: number): boolean {
  const scores = Object.values(s.scores);
  return scores.length > 0 && scores.every((n) => n >= min);
}

/** Levels 1 to 3 for competencies taught through browser exercises (also the base for local ones). */
function browserBase(
  def: CompetencyDef,
  index: ContentIndex,
  data: LearnerData,
  evidence: string[],
): Level {
  let level: Level = 0;

  const questions = index.questions.filter((q) => has(q.competencies, def.id));
  const correct = questions.filter((q) => data.answers[q.id]?.attempts.some((a) => a.correct));
  if (correct.length >= 2) {
    level = 1;
    evidence.push(`${correct.length} tagged questions answered correctly.`);
  }

  const explainSession = sessionsFor(data, def.id).find(
    (s) =>
      s.kind === 'explain' &&
      (s.scores['depth of understanding'] ?? 0) >= 3 &&
      (s.scores['clarity'] ?? 0) >= 3,
  );
  const explainCards = index.cards.filter(
    (c) => c.type === 'explain' && has(c.competencies, def.id),
  );
  const goodRatings = data.reviewLog.filter(
    (r) => r.rating >= 3 && explainCards.some((c) => c.id === r.cardId),
  ).length;
  if (explainSession || goodRatings >= 2) {
    level = Math.max(level, 2) as Level;
    evidence.push(
      explainSession
        ? 'An explain-back session scored 3 or more for depth and clarity.'
        : 'An explain card was rated Good or Easy twice.',
    );
  }

  const passedExercise = index.exercises.find(
    (e) => has(e.competencies, def.id) && data.exercises[e.id]?.attempts.some((a) => a.passed),
  );
  if (passedExercise) {
    level = Math.max(level, 3) as Level;
    evidence.push(`Exercise passed (hints allowed): ${passedExercise.id}.`);
  }
  return level;
}

function unaidedMake(def: CompetencyDef, index: ContentIndex, data: LearnerData) {
  return index.exercises.find(
    (e) =>
      e.kind === 'make' &&
      has(e.competencies, def.id) &&
      (data.exercises[e.id]?.attempts.some(unaidedExercise) ?? false),
  );
}

function localLevel(
  def: CompetencyDef,
  index: ContentIndex,
  data: LearnerData,
  evidence: string[],
  base: Level,
): Level {
  let level = base;
  const lessons = new Set(
    [
      ...index.questions.filter((q) => has(q.competencies, def.id)).map((q) => q.lesson),
      ...index.exercises.filter((e) => has(e.competencies, def.id)).map((e) => e.lesson),
      ...index.practice.filter((p) => has(p.competencies, def.id)).map((p) => p.lesson),
    ].filter(Boolean),
  );
  const mastered = [...lessons].some((l) => masteryPassed(data, l));
  const milestones = index.lessons.filter((l) => lessons.has(l.id)).flatMap((l) => l.labMilestones);
  const labDone = milestones.find((m) => {
    const lab = data.labs[m];
    return lab?.done === true && !!lab.evidenceUrl;
  });
  const checklistDone = index.practice.find(
    (p) =>
      p.kind === 'checklist' &&
      has(p.competencies, def.id) &&
      p.steps > 0 &&
      (data.checklists[p.id]?.done.length ?? 0) >= p.steps,
  );
  if (mastered && (labDone || checklistDone)) {
    level = Math.max(level, 4) as Level;
    evidence.push(
      labDone
        ? `Mastery check passed and lab milestone ${labDone} done with an evidence link.`
        : 'Mastery check passed and the practice checklist is complete.',
    );
    const strong = sessionsFor(data, def.id).find((s) => allScoresAtLeast(s, 4));
    if (strong) {
      level = 5;
      evidence.push('An explain-back or mock session scored 4 or more on everything.');
    }
  }
  return level;
}

function browserLevel(
  def: CompetencyDef,
  index: ContentIndex,
  data: LearnerData,
  evidence: string[],
): Level {
  let level = browserBase(def, index, data, evidence);
  const make = unaidedMake(def, index, data);
  if (make && masteryPassed(data, make.lesson)) {
    level = Math.max(level, 4) as Level;
    evidence.push(`Make exercise ${make.id} passed unaided and the mastery check passed.`);

    const debugEx = index.exercises.find(
      (e) =>
        e.kind === 'debug' &&
        has(e.competencies, def.id) &&
        (data.exercises[e.id]?.attempts.some(unaidedExercise) ?? false),
    );
    const drill = index.drills.find(
      (d) =>
        d.kind === 'code-reading' &&
        has(d.competencies, def.id) &&
        (data.drills[d.id]?.attempts.some((a) => a.passed && !a.solutionViewed) ?? false),
    );
    const strong = sessionsFor(data, def.id).find(
      (s) => s.kind === 'explain' && allScoresAtLeast(s, 4),
    );
    if ((debugEx || drill) && strong) {
      level = 5;
      evidence.push(
        'A debug exercise or drill passed unaided, and an explain-back scored 4 or more.',
      );
    }
  }
  return level;
}

const localDate = (iso: string) => toLocalDate(new Date(iso));

function interviewLevel(
  def: CompetencyDef,
  index: ContentIndex,
  data: LearnerData,
  evidence: string[],
): Level {
  const useDrills = def.id === 'int.code-reading' || def.id === 'int.ai-assisted';
  let level: Level = 0;

  // Each pass is (day, unaided within the time limit).
  const passes: { day: string; strict: boolean }[] = [];
  let anyPass = false;
  if (useDrills) {
    const kind = def.id === 'int.code-reading' ? 'code-reading' : 'ai-assisted';
    for (const d of index.drills.filter((x) => x.kind === kind && has(x.competencies, def.id))) {
      for (const a of data.drills[d.id]?.attempts ?? []) {
        if (!a.passed) continue;
        anyPass = true;
        // For AI-assisted drills AI use is allowed; unaided means the explanation was not viewed.
        if (!a.solutionViewed && a.durationMs <= d.timeLimitMin * 60_000) {
          passes.push({ day: localDate(a.at), strict: true });
        }
      }
    }
  } else {
    for (const p of index.problems.filter((x) => has(x.competencies, def.id))) {
      for (const a of data.gym[p.id]?.attempts ?? []) {
        if (!a.passed) continue;
        anyPass = true;
        if (passedWithinLimit(a, p.timeLimitMin))
          passes.push({ day: localDate(a.at), strict: true });
      }
    }
  }
  if (anyPass) {
    level = 3;
    evidence.push(useDrills ? 'A tagged drill passed.' : 'A tagged gym problem passed.');
  }
  const days = new Set(passes.map((p) => p.day));
  if (passes.length >= 2 && days.size >= 2) {
    level = 4;
    evidence.push('Two passes, unaided within the time limit, on different days.');
    const drill = index.drills.find(
      (d) =>
        d.kind === 'code-reading' &&
        has(d.competencies, def.id) &&
        (data.drills[d.id]?.attempts.some((a) => a.passed && !a.solutionViewed) ?? false),
    );
    if (drill || def.id === 'int.code-reading') {
      level = 5;
      evidence.push('A tagged code-reading drill passed unaided.');
    }
  }
  return level;
}

function isRusty(def: CompetencyDef, index: ContentIndex, data: LearnerData, now: Date): boolean {
  const ids = new Set(index.cards.filter((c) => has(c.competencies, def.id)).map((c) => c.id));
  for (const [id, rec] of Object.entries(data.cards)) {
    if (rec.custom && has(rec.custom.competencies, def.id)) ids.add(id);
  }
  for (const id of ids) {
    const rec = data.cards[id];
    if (!rec) continue;
    if (hasRecentLapses(id, data.reviewLog, now)) return true;
    if (rec.state.state !== 'new') {
      const overdue = now.getTime() - new Date(rec.state.due).getTime();
      if (overdue > RUSTY_OVERDUE_DAYS * DAY_MS) return true;
    }
  }
  return false;
}

/** Questions answered "certain" but wrong in the last 30 days. */
function overconfident(
  def: CompetencyDef,
  index: ContentIndex,
  data: LearnerData,
  now: Date,
): string[] {
  const since = now.getTime() - OVERCONFIDENT_DAYS * DAY_MS;
  return index.questions
    .filter((q) => has(q.competencies, def.id))
    .filter((q) =>
      (data.answers[q.id]?.attempts ?? []).some(
        (a) => a.confidence === 4 && !a.correct && new Date(a.at).getTime() >= since,
      ),
    )
    .map((q) => q.id);
}

/** The highest level whose rule is met (docs/SPEC.md section 13). */
export function computeCompetency(
  def: CompetencyDef,
  index: ContentIndex,
  data: LearnerData,
  now: Date,
): CompetencyResult {
  const evidence: string[] = [];
  let level: Level;
  if (def.evidence === 'interview') level = interviewLevel(def, index, data, evidence);
  else if (def.evidence === 'local') {
    level = localLevel(def, index, data, evidence, browserBase(def, index, data, evidence));
  } else level = browserLevel(def, index, data, evidence);
  return {
    level,
    evidence,
    rusty: isRusty(def, index, data, now),
    overconfident: overconfident(def, index, data, now),
  };
}

export function computeAll(
  defs: CompetencyDef[],
  index: ContentIndex,
  data: LearnerData,
  now: Date,
): Map<string, CompetencyResult> {
  return new Map(defs.map((d) => [d.id, computeCompetency(d, index, data, now)]));
}
