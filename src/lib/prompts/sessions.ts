import { addCustomCard } from '../srs/apply';
import { update, type KeyValueStorage, type LearnerData } from '../store/store';

export type SessionKind = LearnerData['sessions'][number]['kind'];
export type Score = 1 | 2 | 3 | 4 | 5;

export interface SessionInput {
  kind: SessionKind;
  lessonId?: string | undefined;
  exerciseId?: string | undefined;
  competencies: string[];
  scores: Record<string, Score>;
  gaps: string[];
  notes?: string | undefined;
}

/** Log a Claude session: scores (1 to 5) and the gaps it found, each written as a question. */
export function logSession(storage: KeyValueStorage, now: Date, input: SessionInput): string {
  const id = `s-${now.getTime().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
  update(storage, now, (d) => ({
    ...d,
    sessions: [
      ...d.sessions,
      {
        id,
        at: now.toISOString(),
        kind: input.kind,
        ...(input.lessonId ? { lessonId: input.lessonId } : {}),
        ...(input.exerciseId ? { exerciseId: input.exerciseId } : {}),
        competencies: input.competencies,
        scores: input.scores,
        gaps: input.gaps.map((g) => g.trim()).filter(Boolean),
        ...(input.notes ? { notes: input.notes } : {}),
      },
    ],
  }));
  return id;
}

/** One click: a gap (a question the learner should be able to answer) becomes a review card. */
export function gapToCard(
  storage: KeyValueStorage,
  now: Date,
  gap: string,
  competencies: string[],
): string {
  return addCustomCard(storage, now, {
    front: gap,
    back: 'Answer this in your own words, then check it against your notes or the lesson.',
    competencies,
  });
}
