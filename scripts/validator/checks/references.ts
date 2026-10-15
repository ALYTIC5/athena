import { basename } from 'node:path';
import { componentUses } from '../mdx';
import { error, isSampleLesson, warning, type Content, type Issue } from '../types';

const stem = (file: string) => basename(file).replace(/\.(yaml|mdx)$/, '');

/** Remedial lessons are named `<lesson-id>-r<n>`. */
const baseLesson = (id: string) => id.replace(/-r\d+$/, '');

/** Rule 1 (part): references resolve, and published lessons never use planned content. */
export function checkReferences(content: Content): Issue[] {
  const issues: Issue[] = [];
  const status = new Map<string, 'planned' | 'published'>();
  const durations = new Map<string, number>();
  const milestones = new Set<string>();
  for (const w of content.curriculum) {
    for (const l of w.lessons) {
      status.set(l.id, l.status);
      durations.set(l.id, l.durationMin);
    }
    for (const m of w.lab) milestones.add(m.milestone);
  }
  const competencies = new Set(content.competencies.map((c) => c.id));
  const knownLesson = (id: string) =>
    status.has(id) || status.has(baseLesson(id)) || isSampleLesson(id);
  const lessonStatus = (id: string) => status.get(id) ?? status.get(baseLesson(id)) ?? 'planned';

  const tags = (where: string, list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const c of list as string[]) {
      if (!competencies.has(c)) {
        issues.push(error('reference', where, `Unknown competency "${c}".`));
      }
    }
  };

  const lessonOf = (where: string, lesson: unknown) => {
    if (typeof lesson === 'string' && !knownLesson(lesson)) {
      issues.push(
        error('reference', where, `Unknown lesson "${lesson}" (not in curriculum.yaml).`),
      );
    }
  };

  for (const d of [...content.exercises, ...content.practice]) {
    lessonOf(d.file, d.data['lesson']);
    tags(d.file, d.data['competencies']);
  }
  for (const d of [...content.quizzes, ...content.cards, ...content.interview]) {
    lessonOf(d.file, d.data['lesson']);
    for (const key of ['items', 'cards', 'questions']) {
      for (const item of (d.data[key] as { id?: string; competencies?: string[] }[]) ?? []) {
        tags(`${d.file} (${item.id ?? '?'})`, item.competencies);
      }
    }
  }
  for (const d of [...content.problems, ...content.drills]) tags(d.file, d.data['competencies']);

  // Item ids by kind, with the lesson they belong to.
  const exerciseLesson = new Map(
    content.exercises.map((d) => [String(d.data['id']), String(d.data['lesson'])]),
  );
  const practiceLesson = new Map(
    content.practice.map((d) => [String(d.data['id']), String(d.data['lesson'])]),
  );
  const questionLesson = new Map<string, string>();
  for (const q of content.quizzes) {
    for (const i of (q.data['items'] as { id: string }[]) ?? []) {
      questionLesson.set(i.id, String(q.data['lesson']));
    }
  }

  for (const page of content.lessons) {
    const id = stem(page.file);
    if (!knownLesson(id)) {
      issues.push(error('reference', page.file, `Lesson "${id}" is not in curriculum.yaml.`));
      continue;
    }
    const published = lessonStatus(id) === 'published';
    tags(page.file, page.frontmatter['competencies']);
    const planned = durations.get(baseLesson(id));
    if (published && planned !== undefined && page.frontmatter['durationMin'] !== planned) {
      issues.push(
        error(
          'duration',
          page.file,
          `durationMin ${String(page.frontmatter['durationMin'])} must equal ${planned} in curriculum.yaml.`,
        ),
      );
    }
    for (const pre of (page.frontmatter['prerequisites'] as string[] | undefined) ?? []) {
      if (!knownLesson(pre))
        issues.push(error('reference', page.file, `Unknown prerequisite "${pre}".`));
    }

    const use = (name: string, ref: string, owner: string | undefined, kind: string) => {
      if (owner === undefined) {
        issues.push(error('reference', page.file, `<${name}> uses unknown ${kind} "${ref}".`));
        return;
      }
      if (published && lessonStatus(owner) === 'planned' && !isSampleLesson(owner)) {
        issues.push(
          error(
            'planned-content',
            page.file,
            `Published lesson uses ${kind} "${ref}" of the planned lesson "${owner}".`,
          ),
        );
      }
    };

    for (const c of componentUses(page.body)) {
      const a = c.attrs;
      if (c.name === 'Exercise' && a['id'])
        use(c.name, a['id'], exerciseLesson.get(a['id']), 'exercise');
      if (c.name === 'ExplainBack' && a['exercise']) {
        use(c.name, a['exercise'], exerciseLesson.get(a['exercise']), 'exercise');
      }
      if ((c.name === 'Predict' || c.name === 'Parsons') && a['item']) {
        use(c.name, a['item'], questionLesson.get(a['item']), 'question');
      }
      if ((c.name === 'Checklist' || c.name === 'Rubric') && a['id']) {
        use(c.name, a['id'], practiceLesson.get(a['id']), 'practice item');
      }
      if (c.name === 'LabStep' && a['milestone'] && !milestones.has(a['milestone'])) {
        issues.push(
          error(
            'reference',
            page.file,
            `<LabStep> milestone "${a['milestone']}" is not listed in curriculum.yaml.`,
          ),
        );
      }
      if (
        ['Quiz', 'WarmUp', 'MasteryCheck', 'InterviewCorner'].includes(c.name) &&
        a['lesson'] &&
        a['lesson'] !== id
      ) {
        issues.push(
          warning(
            'reference',
            page.file,
            `<${c.name}> uses lesson "${a['lesson']}" on the page for "${id}".`,
          ),
        );
      }
    }
  }

  // A published lesson needs its page.
  for (const [id, s] of status) {
    if (s === 'published' && !content.lessons.some((p) => stem(p.file) === id)) {
      issues.push(
        error(
          'reference',
          'src/content/curriculum.yaml',
          `Lesson "${id}" is published but has no page.`,
        ),
      );
    }
  }
  return issues;
}
