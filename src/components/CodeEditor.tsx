import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { del, get, set } from 'idb-keyval';
import { athenaHighlighting } from '../lib/editor/highlight';

export interface CodeEditorHandle {
  getCode(): string;
  setCode(code: string): void;
  focus(): void;
  resetToInitial(): void;
}

interface Props {
  initial: string;
  /** Accessible name, for example "Python code editor". */
  label: string;
  language: 'python' | 'sql';
  /** When set, the code is saved as a draft in IndexedDB under this key. */
  draftKey?: string;
  onChange?: (code: string) => void;
}

/** CodeMirror 6, loaded on demand when the component mounts. Shows plain code until it is ready. */
export const CodeEditor = forwardRef<CodeEditorHandle, Props>(function CodeEditor(
  { initial, label, language, draftKey, onChange },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<{ getCode(): string; setCode(c: string): void; focus(): void } | null>(null);
  const [ready, setReady] = useState(false);
  const code = useRef(initial);

  useImperativeHandle(ref, () => ({
    getCode: () => view.current?.getCode() ?? code.current,
    setCode: (c) => {
      code.current = c;
      view.current?.setCode(c);
    },
    focus: () => view.current?.focus(),
    resetToInitial: () => {
      code.current = initial;
      view.current?.setCode(initial);
      if (draftKey) void del(`draft:${draftKey}`).catch(() => undefined);
    },
  }));

  useEffect(() => {
    let destroyed = false;
    let destroy: (() => void) | undefined;
    void (async () => {
      const [{ EditorView, basicSetup }, lang, { keymap }, { indentWithTab }, highlight] =
        await Promise.all([
          import('codemirror'),
          language === 'sql'
            ? import('@codemirror/lang-sql').then((m) => m.sql())
            : import('@codemirror/lang-python').then((m) => m.python()),
          import('@codemirror/view'),
          import('@codemirror/commands'),
          athenaHighlighting(),
        ]);
      if (destroyed || !host.current) return;
      const saved = draftKey
        ? await get<string>(`draft:${draftKey}`).catch(() => undefined)
        : undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const v = new EditorView({
        doc: saved ?? initial,
        parent: host.current,
        extensions: [
          basicSetup,
          highlight,
          EditorView.lineWrapping,
          lang,
          keymap.of([indentWithTab]),
          EditorView.contentAttributes.of({ 'aria-label': label }),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            const text = u.state.doc.toString();
            code.current = text;
            onChange?.(text);
            if (!draftKey) return;
            clearTimeout(timer);
            timer = setTimeout(
              () => void set(`draft:${draftKey}`, text).catch(() => undefined),
              400,
            );
          }),
        ],
      });
      code.current = v.state.doc.toString();
      view.current = {
        getCode: () => v.state.doc.toString(),
        setCode: (c) => v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: c } }),
        focus: () => v.focus(),
      };
      destroy = () => v.destroy();
      onChange?.(code.current);
      setReady(true);
    })();
    return () => {
      destroyed = true;
      destroy?.();
      view.current = null;
    };
    // The editor is created once per mount; props that change later are handled through the ref.
  }, []);

  return (
    <div>
      <div ref={host} data-testid="editor-host" />
      {!ready && (
        <pre aria-label={`${label} (loading)`}>
          <code>{initial}</code>
        </pre>
      )}
      {ready && (
        <p>
          <small>Press Esc, then Tab, to leave the editor.</small>
        </p>
      )}
    </div>
  );
});
