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
        './src/components/ExplainBack.astro',
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
      head: [
        {
          // Scrollable code blocks are region landmarks; give each a unique name for screen readers.
          tag: 'script',
          content: `(function () {
  function label() {
    document.querySelectorAll("pre[role='region']:not([aria-label])").forEach(function (el, i) {
      el.setAttribute('aria-label', (el.getAttribute('data-language') || 'code') + ' example ' + (i + 1));
    });
  }
  // A code block that scrolls must be reachable by keyboard. Expressive Code does this once on load,
  // but the layout can still change afterwards (fonts, window size), so check again.
  function focusable() {
    document.querySelectorAll('pre').forEach(function (el) {
      var scrolls = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
      if (scrolls && !el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'region');
      }
    });
    label();
  }
  document.addEventListener('DOMContentLoaded', function () {
    label();
    new MutationObserver(label).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['role'] });
    focusable();
    window.addEventListener('load', focusable);
    window.addEventListener('resize', focusable);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(focusable);
  });
})();`,
        },
      ],
      components: { SiteTitle: './src/components/SiteTitle.astro' },
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
