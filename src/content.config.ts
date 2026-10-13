import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
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
} from './content/schemas';

const yamlDir = (base: string) => glob({ pattern: '*.yaml', base: `./src/content/${base}` });

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: lessonFields }) }),
  exercises: defineCollection({ loader: yamlDir('exercises'), schema: exerciseSchema }),
  quizzes: defineCollection({ loader: yamlDir('quizzes'), schema: quizSchema }),
  practice: defineCollection({ loader: yamlDir('practice'), schema: practiceSchema }),
  cards: defineCollection({ loader: yamlDir('cards'), schema: cardsSchema }),
  interview: defineCollection({ loader: yamlDir('interview'), schema: interviewSchema }),
  problems: defineCollection({ loader: yamlDir('problems'), schema: problemSchema }),
  drills: defineCollection({ loader: yamlDir('drills'), schema: drillSchema }),
  curriculum: defineCollection({
    loader: file('./src/content/curriculum.yaml'),
    schema: curriculumWeekSchema,
  }),
  competencies: defineCollection({
    loader: file('./src/content/competencies.yaml'),
    schema: competencySchema,
  }),
};
