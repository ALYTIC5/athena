import { expect, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const CDN = /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v314\.0\.7\/full\/(.+)$/;

/** Serve Pyodide (and cached wheels) from disk so tests never depend on the CDN. */
export async function serveFromDisk(page: Page) {
  await page.context().route(CDN, async (route) => {
    const name = CDN.exec(route.request().url())?.[1]?.split('?')[0] ?? '';
    for (const dir of ['node_modules/pyodide', '.pyodide-cache']) {
      const file = `${dir}/${name}`;
      if (existsSync(file)) {
        await route.fulfill({
          body: await readFile(file),
          headers: {
            'access-control-allow-origin': '*',
            'content-type': name.endsWith('.wasm')
              ? 'application/wasm'
              : name.endsWith('.json')
                ? 'application/json'
                : 'text/javascript',
          },
        });
        return;
      }
    }
    await route.continue();
  });
}

/** Stand in for claude.ai so a popup opens without any real request. */
export async function stubClaude(page: Page) {
  await page
    .context()
    .route('https://claude.ai/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Claude</title><p>stub</p>' }),
    );
}

/** Hydrate every client:visible island: wait for the custom element, then scroll each into view. */
export async function hydrateAll(page: Page) {
  await page.waitForFunction(() => customElements.get('astro-island') !== undefined);
  for (let round = 0; round < 8; round++) {
    const remaining = await page.evaluate(async () => {
      const pending = Array.from(document.querySelectorAll('astro-island[ssr]'));
      for (const island of pending) {
        (island.firstElementChild ?? island).scrollIntoView({ block: 'center' });
        await new Promise((r) => setTimeout(r, 150));
      }
      return pending.length;
    });
    if (remaining === 0) break;
  }
}

export async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('athena') ?? '{}'));
}

export async function seedStore(page: Page, json: string) {
  await page.addInitScript((value) => {
    if (!window.localStorage.getItem('athena')) window.localStorage.setItem('athena', value);
  }, json);
}

/** Replace the contents of a CodeMirror editor, using only the keyboard. */
export async function typeInEditor(page: Page, editor: Locator, code: string) {
  await editor.focus();
  await expect(editor).toBeFocused();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(code);
}

/**
 * Replace the clipboard so tests can read what was copied in every browser (Firefox and WebKit
 * do not allow granting clipboard permissions).
 */
export async function fakeClipboard(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied?: string };
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          w.__copied = text;
        },
        readText: async () => w.__copied ?? '',
      },
      configurable: true,
    });
  });
}

export async function copied(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '');
}
