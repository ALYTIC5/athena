import { useEffect, useRef, useState } from 'react';

export interface SortItem {
  key: string;
  text: string;
  indent: number;
}

interface Props {
  label: string;
  items: SortItem[];
  onChange(items: SortItem[]): void;
  /** Parsons lines can be indented; ordering steps cannot. */
  allowIndent: boolean;
  /** Called when the learner removes an item (Parsons: back to the available lines). */
  onRemove?(key: string): void;
  disabled?: boolean;
  code?: boolean;
}

const MAX_INDENT = 4;

/**
 * Keyboard model (docs/SPEC.md §7): Space picks up the focused line, the arrow keys move it,
 * Tab and Shift+Tab change its indentation only while it is picked up, Enter drops it.
 * Buttons offer the same actions for pointer users. A live region announces each change.
 */
export function SortableList({
  label,
  items,
  onChange,
  allowIndent,
  onRemove,
  disabled,
  code,
}: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const refs = useRef(new Map<string, HTMLButtonElement>());

  // Reordering can drop focus in some browsers, so refocus right after the render that moved the
  // item. Doing it in an effect (not a later animation frame) cannot steal focus from a later action.
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocus.current) {
      refs.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });
  const focusKey = (key: string) => {
    pendingFocus.current = key;
  };

  const move = (key: string, delta: -1 | 1) => {
    const i = items.findIndex((x) => x.key === key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j] as SortItem, next[i] as SortItem];
    onChange(next);
    setAnnouncement(`Moved to position ${j + 1} of ${items.length}`);
    focusKey(key);
  };

  const indent = (key: string, delta: -1 | 1) => {
    if (!allowIndent) return;
    const next = items.map((x) =>
      x.key === key ? { ...x, indent: Math.min(MAX_INDENT, Math.max(0, x.indent + delta)) } : x,
    );
    const changed = next.find((x) => x.key === key);
    onChange(next);
    setAnnouncement(`Indent level ${changed?.indent ?? 0}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (disabled) return;
    const isPicked = picked === key;
    if (e.key === ' ') {
      e.preventDefault();
      setPicked(isPicked ? null : key);
      setAnnouncement(isPicked ? 'Dropped' : 'Picked up. Use the arrow keys to move.');
    } else if (e.key === 'Enter' && isPicked) {
      e.preventDefault();
      setPicked(null);
      setAnnouncement('Dropped');
    } else if (isPicked && e.key === 'ArrowUp') {
      e.preventDefault();
      move(key, -1);
    } else if (isPicked && e.key === 'ArrowDown') {
      e.preventDefault();
      move(key, 1);
    } else if (isPicked && allowIndent && e.key === 'Tab') {
      e.preventDefault();
      indent(key, e.shiftKey ? -1 : 1);
    } else if (isPicked && e.key === 'Escape') {
      setPicked(null);
      setAnnouncement('Dropped');
    } else if (onRemove && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      const i = items.findIndex((x) => x.key === key);
      onRemove(key);
      const neighbour = items[i + 1] ?? items[i - 1];
      if (neighbour) focusKey(neighbour.key);
    }
  };

  return (
    <div>
      <ol aria-label={label} className="athena-sortable">
        {items.map((it, i) => (
          <li key={it.key} style={{ marginLeft: `${it.indent * 1.5}rem` }}>
            <button
              type="button"
              ref={(el) => {
                if (el) refs.current.set(it.key, el);
                else refs.current.delete(it.key);
              }}
              aria-pressed={picked === it.key}
              aria-label={`${it.text}, position ${i + 1} of ${items.length}${allowIndent ? `, indent ${it.indent}` : ''}${picked === it.key ? ', picked up' : ''}`}
              disabled={disabled}
              onKeyDown={(e) => onKeyDown(e, it.key)}
              onClick={() => setPicked(picked === it.key ? null : it.key)}
              className={code ? 'athena-code-line' : undefined}
            >
              {it.text}
            </button>
            {!disabled && (
              <span className="athena-line-tools">
                <button
                  type="button"
                  onClick={() => move(it.key, -1)}
                  aria-label={`Move up: ${it.text}`}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => move(it.key, 1)}
                  aria-label={`Move down: ${it.text}`}
                >
                  Down
                </button>
                {allowIndent && (
                  <>
                    <button
                      type="button"
                      onClick={() => indent(it.key, 1)}
                      aria-label={`Indent: ${it.text}`}
                    >
                      Indent
                    </button>
                    <button
                      type="button"
                      onClick={() => indent(it.key, -1)}
                      aria-label={`Outdent: ${it.text}`}
                    >
                      Outdent
                    </button>
                  </>
                )}
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(it.key)}
                    aria-label={`Remove: ${it.text}`}
                  >
                    Remove
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="athena-sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
