import { basename } from 'node:path';
import type { ZodType } from 'astro/zod';
import {
  cardsSchema,
  competencySchema,
  curriculumWeekSchema,
  drillSchema,
  exerciseSchema,
  interviewSchema,
  lessonFields,
  practiceSchema,
  problemSchema,
  quizSchema,
} from '../../../src/content/schemas';
import { error, type Content, type Doc, type Issue } from '../types';

const stem = (file: string) => basename(file).replace(/\.(yaml|mdx)$/, '');

function check(schema: ZodType, doc: Doc, issues: Issue[]): boolean {
  const r = schema.safeParse(doc.data);
  if (r.success) return true;
  for (const i of r.error.issues.slice(0, 5)) {
    issues.push(error('schema', doc.file, `${i.path.join('.') || '(root)'}: ${i.message}`));
  }
  return false;
}

/** Rule 1 (part): every file matches its schema; ids equal file names; ids are unique. */
export function checkSchemas(content: Content): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, string>();
  const unique = (kind: string, id: string, file: string) => {
    const key = `${kind}:${id}`;
    const prev = seen.get(key);
    if (prev)
      issues.push(error('unique-id', file, `Duplicate ${kind} id "${id}" (also in ${prev}).`));
    else seen.set(key, file);
  };

  const byId = (docs: Doc[], schema: ZodType, kind: string, prefixed: boolean) => {
    for (const doc of docs) {
      if (!check(schema, doc, issues)) continue;
      const id = String(doc.data['id']);
      if (id !== stem(doc.file)) {
        issues.push(
          error(
            'id-matches-file',
            doc.file,
            `id "${id}" must equal the file name "${stem(doc.file)}".`,
          ),
        );
      }
      unique(kind, id, doc.file);
      const lesson = doc.data['lesson'];
      if (prefixed && typeof lesson === 'string' && !id.startsWith(lesson)) {
        issues.push(
          error('id-prefix', doc.file, `id "${id}" must start with its lesson id "${lesson}".`),
        );
      }
    }
  };

  byId(content.exercises, exerciseSchema, 'exercise', true);
  byId(content.practice, practiceSchema, 'practice', true);
  byId(content.problems, problemSchema, 'problem', false);
  byId(content.drills, drillSchema, 'drill', false);

  const byLesson = (docs: Doc[], schema: ZodType, kind: string, itemsKey: string) => {
    for (const doc of docs) {
      if (!check(schema, doc, issues)) continue;
      const lesson = String(doc.data['lesson']);
      if (lesson !== stem(doc.file)) {
        issues.push(
          error(
            'id-matches-file',
            doc.file,
            `lesson "${lesson}" must equal the file name "${stem(doc.file)}".`,
          ),
        );
      }
      for (const item of (doc.data[itemsKey] as { id: string }[]) ?? []) {
        unique(kind, item.id, doc.file);
        if (!item.id.startsWith(lesson)) {
          issues.push(
            error(
              'id-prefix',
              doc.file,
              `${kind} id "${item.id}" must start with its lesson id "${lesson}".`,
            ),
          );
        }
      }
    }
  };
  byLesson(content.quizzes, quizSchema, 'question', 'items');
  byLesson(content.cards, cardsSchema, 'card', 'cards');
  byLesson(content.interview, interviewSchema, 'interview', 'questions');

  for (const w of content.curriculum) {
    check(curriculumWeekSchema, { file: 'src/content/curriculum.yaml', data: w as never }, issues);
  }
  for (const c of content.competencies) {
    check(competencySchema, { file: 'src/content/competencies.yaml', data: c as never }, issues);
  }

  // Lesson pages: the extra frontmatter fields are required for every page under lessons/.
  const required = [
    'lessonId',
    'week',
    'track',
    'durationMin',
    'anatomy',
    'competencies',
    'whyItMatters',
    'objectives',
    'sources',
  ];
  for (const page of content.lessons) {
    const r = lessonFields.safeParse(page.frontmatter);
    if (!r.success) {
      for (const i of r.error.issues.slice(0, 5)) {
        issues.push(error('schema', page.file, `frontmatter ${i.path.join('.')}: ${i.message}`));
      }
    }
    for (const key of required) {
      if (page.frontmatter[key] === undefined) {
        issues.push(error('frontmatter', page.file, `Missing required lesson field "${key}".`));
      }
    }
    if (
      page.frontmatter['lessonId'] !== undefined &&
      page.frontmatter['lessonId'] !== stem(page.file)
    ) {
      issues.push(error('id-matches-file', page.file, 'lessonId must equal the file name.'));
    }
  }
  return issues;
}
