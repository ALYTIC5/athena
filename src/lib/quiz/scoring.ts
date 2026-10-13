import type { Question, Response } from './types';

export interface Verdict {
  correct: boolean;
  /** Plain-language explanation shown after answering. */
  explanation: string;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Trailing whitespace on each line and at the end is ignored (SPEC §7). */
export function normaliseOutput(s: string): string {
  return s
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\s+$/, '');
}

function indentOf(line: string): number {
  const m = /^( *)/.exec(line);
  return Math.floor((m?.[1]?.length ?? 0) / 4);
}

export function parsonsSolution(q: Extract<Question, { type: 'parsons' }>) {
  return q.lines.map((l) => ({ text: l.trim(), indent: indentOf(l) }));
}

export function scoreQuestion(q: Question, r: Response): Verdict {
  switch (q.type) {
    case 'single': {
      if (r.type !== 'single' || r.selected === null) return { correct: false, explanation: '' };
      const chosen = q.options[r.selected];
      const right = q.options.findIndex((o) => o.correct);
      const rightWhy = q.options[right]?.why ?? '';
      return {
        correct: chosen?.correct === true,
        explanation: chosen?.correct ? rightWhy : `${chosen?.why ?? ''} ${rightWhy}`.trim(),
      };
    }
    case 'multiple': {
      if (r.type !== 'multiple') return { correct: false, explanation: '' };
      const want = q.options.flatMap((o, i) => (o.correct ? [i] : []));
      const got = [...r.selected].sort((a, b) => a - b);
      const correct = want.length === got.length && want.every((v, i) => v === got[i]);
      return { correct, explanation: '' };
    }
    case 'short': {
      if (r.type !== 'short') return { correct: false, explanation: '' };
      const t = norm(r.text);
      const hit =
        q.accepted.some((a) => norm(a) === t) ||
        q.patterns.some((p) => new RegExp(p, 'i').test(r.text.trim()));
      return { correct: hit, explanation: q.explanation };
    }
    case 'predict': {
      if (r.type !== 'predict') return { correct: false, explanation: '' };
      return {
        correct: normaliseOutput(r.text) === normaliseOutput(q.expected),
        explanation: '',
      };
    }
    case 'parsons': {
      if (r.type !== 'parsons') return { correct: false, explanation: '' };
      const want = parsonsSolution(q);
      const correct =
        want.length === r.lines.length &&
        want.every((w, i) => {
          const got = r.lines[i];
          return got !== undefined && got.text.trim() === w.text && got.indent === w.indent;
        });
      return { correct, explanation: '' };
    }
    case 'bug': {
      if (r.type !== 'bug' || r.line === null) return { correct: false, explanation: '' };
      return { correct: r.line === q.buggyLine, explanation: q.explanation };
    }
    case 'order': {
      if (r.type !== 'order') return { correct: false, explanation: '' };
      const correct =
        q.steps.length === r.steps.length && q.steps.every((s, i) => s === r.steps[i]);
      return { correct, explanation: '' };
    }
  }
}

/** Mastery pass: 80% or more of the questions correct. The make exercise is checked separately. */
export const MASTERY_PASS_FRACTION = 0.8;

export function masteryScore(results: { correct: boolean }[]): number {
  return results.length === 0 ? 0 : results.filter((r) => r.correct).length / results.length;
}

export function masteryPassed(score: number, exerciseUnaided: boolean): boolean {
  return score >= MASTERY_PASS_FRACTION && exerciseUnaided;
}
