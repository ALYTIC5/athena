import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import starlightLinksValidator from 'starlight-links-validator';

export default defineConfig({
  site: 'https://alytic5.github.io',
  base: '/athena',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Athena',
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
    react(),
  ],
});
