import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Content, CurriculumWeek, Doc, LessonPage } from './types';

const CONTENT = 'src/content';

function yamlDir(dir: string): Doc[] {
  const base = join(CONTENT, dir);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => {
      const file = `${CONTENT}/${dir}/${f}`;
      const data = parse(readFileSync(file, 'utf8')) as Record<string, unknown> | null;
      return { file, data: data ?? {} };
    });
}

/** Split `---` frontmatter from the body of an MDX file. */
export function splitFrontmatter(text: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { frontmatter: {}, body: text };
  const fm = parse(m[1] ?? '') as Record<string, unknown> | null;
  return { frontmatter: fm ?? {}, body: m[2] ?? '' };
}

function lessonPages(): LessonPage[] {
  const base = join(CONTENT, 'docs/lessons');
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((f) => f.endsWith('.mdx') && f !== 'index.mdx')
    .sort()
    .map((f) => {
      const file = `${CONTENT}/docs/lessons/${f}`;
      const { frontmatter, body } = splitFrontmatter(readFileSync(file, 'utf8'));
      return { file, frontmatter, body };
    });
}

export function loadContent(): Content {
  const curriculum = parse(
    readFileSync(join(CONTENT, 'curriculum.yaml'), 'utf8'),
  ) as CurriculumWeek[];
  const competencies = parse(readFileSync(join(CONTENT, 'competencies.yaml'), 'utf8')) as {
    id: string;
  }[];
  return {
    curriculum,
    competencies,
    lessons: lessonPages(),
    exercises: yamlDir('exercises'),
    quizzes: yamlDir('quizzes'),
    practice: yamlDir('practice'),
    cards: yamlDir('cards'),
    interview: yamlDir('interview'),
    problems: yamlDir('problems'),
    drills: yamlDir('drills'),
  };
}
