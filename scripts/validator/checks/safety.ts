import { error, type Issue } from '../types';

export interface TextFile {
  file: string;
  text: string;
}

/** Marker that makes a synthetic secret acceptable (also allowlisted by one regex in .gitleaks.toml). */
export const FAKE_MARKER = 'ATHENA_FAKE';

const SECRET_PATTERNS: [string, RegExp][] = [
  ['an OpenAI-style key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['an AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['a GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

const ALLOWED_EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net'];

/** Phone-number-like text. Only the reserved fictional ranges are allowed. */
const PHONE_PATTERNS: RegExp[] = [
  /\+\d[\d\s().-]{7,}\d/g, // international format
  /\b0\d{3,4}[ -]\d{5,6}\b/g, // national UK style
  /\(\d{3}\)\s?\d{3}-\d{4}/g, // (212) 555-0123
  /\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/g, // 212-555-0123
  /\b555-\d{4}\b/g,
];

/** UK +44 7700 900000 to 900999, and US 555-0100 to 555-0199. */
export function isReservedPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  // UK: 44 7700 900xxx, or 07700 900xxx
  if (/^(?:44|0)?7700900\d{3}$/.test(digits)) return true;
  // US: 555-01xx with or without area code and country code
  if (/^(?:1)?(?:\d{3})?5550(?:1\d{2})$/.test(digits)) return true;
  return false;
}

/** Rule 8: no secrets, only reserved phone numbers, only example email domains. */
export function checkSafetyText(files: TextFile[]): Issue[] {
  const issues: Issue[] = [];
  for (const { file, text } of files) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const where = `${file}:${i + 1}`;
      for (const [label, re] of SECRET_PATTERNS) {
        if (re.test(line) && !line.includes(FAKE_MARKER)) {
          issues.push(
            error(
              'safety',
              where,
              `Looks like ${label}. Synthetic secrets must contain ${FAKE_MARKER}.`,
            ),
          );
        }
      }
      for (const m of line.matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g)) {
        const domain = (m[1] ?? '').toLowerCase();
        if (!ALLOWED_EMAIL_DOMAINS.includes(domain) && !domain.endsWith('.test')) {
          issues.push(
            error(
              'safety',
              where,
              `Email address "${m[0]}" must use example.com, example.org, example.net or .test.`,
            ),
          );
        }
      }
      for (const re of PHONE_PATTERNS) {
        for (const m of line.matchAll(re)) {
          const digits = m[0].replace(/\D/g, '');
          if (digits.length < 9 || digits.length > 15) continue;
          if (/^\d{4}-\d{2}-\d{2}/.test(m[0].trim())) continue; // an ISO date
          if (!isReservedPhone(m[0])) {
            issues.push(
              error(
                'safety',
                where,
                `Phone number "${m[0].trim()}" is not in a reserved range (UK +44 7700 900000 to 900999, US 555-0100 to 0199).`,
              ),
            );
          }
        }
      }
    });
  }
  return issues;
}
