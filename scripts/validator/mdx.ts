export interface ComponentUse {
  name: string;
  attrs: Record<string, string>;
}

/** Component tags used in an MDX body, with simple string and number attributes. */
export function componentUses(body: string): ComponentUse[] {
  const out: ComponentUse[] = [];
  for (const m of body.matchAll(/<([A-Z][A-Za-z]*)\b([^>]*?)\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of (m[2] ?? '').matchAll(/([A-Za-z]+)=(?:"([^"]*)"|\{([^}]*)\})/g)) {
      attrs[a[1] as string] = (a[2] ?? a[3] ?? '').trim();
    }
    // A bare boolean attribute such as `prior`.
    for (const b of (m[2] ?? '').matchAll(/\s([a-z]+)(?=\s|$)/g)) {
      if (!((b[1] as string) in attrs)) attrs[b[1] as string] = 'true';
    }
    out.push({ name: m[1] as string, attrs });
  }
  return out;
}

export interface CodeBlock {
  lang: string;
  meta: string;
  code: string;
}

/** Fenced code blocks, with the info string split into language and attributes. */
export function codeBlocks(body: string): CodeBlock[] {
  const out: CodeBlock[] = [];
  for (const m of body.matchAll(/^```([A-Za-z0-9_-]*)([^\n]*)\n([\s\S]*?)^```/gm)) {
    out.push({ lang: m[1] ?? '', meta: (m[2] ?? '').trim(), code: m[3] ?? '' });
  }
  return out;
}

/** Value of `name="..."` in a code block's info string. */
export function metaValue(meta: string, name: string): string | undefined {
  return new RegExp(`${name}="([^"]*)"`).exec(meta)?.[1];
}
