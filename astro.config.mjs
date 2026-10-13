import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import AutoImport from 'astro-auto-import';
import starlightLinksValidator from 'starlight-links-validator';

export default defineConfig({
  site: 'https://alytic5.github.io',
  base: '/athena',
  trailingSlash: 'always',
  integrations: [
    // Lesson components are available in every MDX file without imports. Must come before MDX.
    AutoImport({
      imports: [
        './src/components/Callout.astro',
        './src/components/Checklist.astro',
        './src/components/Chunk.astro',
        './src/components/Exercise.astro',
        './src/components/InterviewCorner.astro',
        './src/components/LabStep.astro',
        './src/components/MasteryCheck.astro',
        './src/components/Parsons.astro',
        './src/components/Predict.astro',
        './src/components/Quiz.astro',
        './src/components/Rubric.astro',
        './src/components/SessionBreak.astro',
        './src/components/WarmUp.astro',
      ],
    }),
    starlight({
      title: 'Athena',
      customCss: ['./src/styles/athena.css'],
      plugins: [starlightLinksValidator()],
      sidebar: [
        { label: 'Home', link: '/' },
        { label: 'Start here', link: '/start/' },
        { label: 'Lessons', link: '/lessons/' },
        { label: 'Review', link: '/review/' },
        { label: 'Interview Gym', link: '/gym/' },
        { label: 'Labs', link: '/labs/' },
        { label: 'Competencies', link: '/competencies/' },
        { label: 'Settings', link: '/settings/' },
        { label: 'About', link: '/about/' },
      ],
    }),
    mdx(),
    react(),
  ],
});
