/**
 * Syntax colours for CodeMirror that meet WCAG AA contrast in light and dark themes. The colours
 * come from CSS variables (see src/styles/athena.css), so the theme switch needs no reload.
 */
export async function athenaHighlighting() {
  const [{ HighlightStyle, syntaxHighlighting }, { tags: t }] = await Promise.all([
    import('@codemirror/language'),
    import('@lezer/highlight'),
  ]);
  return syntaxHighlighting(
    HighlightStyle.define([
      {
        tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword],
        color: 'var(--athena-tok-keyword)',
      },
      { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--athena-tok-string)' },
      { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--athena-tok-number)' },
      {
        tag: [t.comment, t.lineComment, t.blockComment],
        color: 'var(--athena-tok-comment)',
        fontStyle: 'italic',
      },
      {
        tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)],
        color: 'var(--athena-tok-function)',
      },
      { tag: [t.typeName, t.className], color: 'var(--athena-tok-type)' },
    ]),
  );
}
