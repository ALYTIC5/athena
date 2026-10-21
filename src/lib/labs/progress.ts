/** The two project labs. The slug is the folder under `labs/` and the page URL under `/labs/`. */
export const LABS = [
  {
    slug: 'webhook-agent',
    name: 'Lab A: webhook-to-agent service',
    summary:
      'A FastAPI service that receives signed call-ended webhooks, queues them in PostgreSQL and has a worker run an agent that classifies the call and books, cancels or escalates.',
    prefix: 'wa-',
  },
  {
    slug: 'rag-evals',
    name: 'Lab B: memory retrieval with evals',
    summary:
      'A retrieval tool over a corpus of invented caller memories, with an eval set, a metrics command, an honest experiment report and an eval gate in CI.',
    prefix: 're-',
  },
] as const;

export type LabSlug = (typeof LABS)[number]['slug'];

export function labForMilestone(milestone: string): (typeof LABS)[number] | undefined {
  return LABS.find((lab) => milestone.startsWith(lab.prefix));
}

const MAX_EVIDENCE_LENGTH = 500;

export type EvidenceResult = { ok: true; url: string } | { ok: false; error: string };

/** Evidence is a link to a commit, a CI run or a report. Only plain https links are kept. */
export function parseEvidenceUrl(input: string): EvidenceResult {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'Paste a link to your commit, CI run or report.' };
  if (text.length > MAX_EVIDENCE_LENGTH) return { ok: false, error: 'That link is too long.' };
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, error: 'That is not a full link. Start it with https://.' };
  }
  if (parsed.protocol !== 'https:')
    return { ok: false, error: 'The link must start with https://.' };
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, error: 'The link must not contain a user name or password.' };
  }
  return { ok: true, url: parsed.href };
}

/** Add or remove a checklist item index from the stored list, keeping it sorted and unique. */
export function toggleItem(done: readonly string[], index: number, checked: boolean): string[] {
  const key = String(index);
  const rest = done.filter((d) => d !== key);
  return (checked ? [...rest, key] : rest).sort((a, b) => Number(a) - Number(b));
}

export const checklistKey = (milestone: string): string => `lab-${milestone}`;

/** Number of `- [ ]` task items in a milestone's markdown. */
export function countChecklistItems(markdown: string): number {
  return markdown.split('\n').filter((line) => /^\s*[-*] \[[ xX]\] /.test(line)).length;
}

/** The text of the first `# ` heading, without a leading milestone id such as `wa-m2: `. */
export function firstHeading(markdown: string): string {
  const line = markdown.split('\n').find((l) => l.startsWith('# '));
  return line ? line.slice(2).trim() : '';
}

export function milestoneTitle(heading: string): string {
  return heading.replace(/^[a-z]{2}-m\d+:\s*/, '').replace(/\s*\([^)]*\)\s*$/, '');
}

/** Time estimate from a heading like `wa-m2: ... (about 2.5 hours, week 12)`, if there is one. */
export function milestoneHours(heading: string): string {
  const m = /\(about ([^,)]+)/.exec(heading);
  return m?.[1] ?? '';
}
