import { useState } from 'react';
import { browserEnv, deliverPrompt } from '../../lib/prompts/deliver';

interface Props {
  label: string;
  prompt: string;
  /** Called after the click, once the Claude tab was opened and the copy attempted. */
  onDelivered?: () => void;
}

/** Opens the Claude tab, copies the prompt, then says so. The prompt stays visible to read or copy. */
export function PromptCopy({ label, prompt, onDelivered }: Props) {
  const [message, setMessage] = useState('');

  const click = () => {
    // deliverPrompt opens the tab synchronously before the async copy.
    void deliverPrompt(prompt, browserEnv()).then((r) => {
      setMessage(r.message);
      onDelivered?.();
    });
  };

  return (
    <div>
      <p>
        <button type="button" onClick={click} data-testid="copy-prompt">
          {label}
        </button>
      </p>
      <p role="status" aria-live="polite" data-testid="prompt-status">
        {message}
      </p>
      <details>
        <summary>Show the prompt</summary>
        <textarea readOnly rows={10} cols={70} value={prompt} aria-label="Prompt text" />
      </details>
    </div>
  );
}
