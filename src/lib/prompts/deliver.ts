export const CLAUDE_URL = 'https://claude.ai/new';
export const COPIED_MESSAGE = 'Prompt copied: paste it into Claude.';

export interface DeliverEnv {
  open(url: string, target: string, features: string): unknown;
  writeText(text: string): Promise<void>;
}

export type DeliverResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Open the Claude tab first, then copy the prompt (so popup blockers do not interfere), then
 * report. `open` must run synchronously inside the click handler.
 */
export async function deliverPrompt(text: string, env: DeliverEnv): Promise<DeliverResult> {
  env.open(CLAUDE_URL, '_blank', 'noopener');
  try {
    await env.writeText(text);
    return { ok: true, message: COPIED_MESSAGE };
  } catch {
    return {
      ok: false,
      message: 'Could not copy the prompt. Select it below and copy it by hand.',
    };
  }
}

export function browserEnv(): DeliverEnv {
  return {
    open: (url, target, features) => window.open(url, target, features),
    writeText: (text) => navigator.clipboard.writeText(text),
  };
}
