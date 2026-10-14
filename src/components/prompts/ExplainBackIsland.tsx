import { useEffect, useState } from 'react';
import { get } from 'idb-keyval';
import { SCORE_LABELS, explainBackPrompt } from '../../lib/prompts/templates';
import { load } from '../../lib/store/store';
import { PromptCopy } from './PromptCopy';
import { SessionLog } from './SessionLog';

interface Props {
  lesson: string;
  exercise: string;
  objectives: string[];
  competencies: string[];
}

/** After a make exercise: Claude interviews the learner about their own code, then they log the result. */
export function ExplainBackIsland({ lesson, exercise, objectives, competencies }: Props) {
  const [code, setCode] = useState('');
  const [track, setTrack] = useState('AI automation');
  const [delivered, setDelivered] = useState(false);

  useEffect(() => {
    const stored = load(window.localStorage);
    if (stored.status === 'ok') setTrack(stored.data.settings.jobTrack);
    void get<string>(`draft:${exercise}`)
      .then((d) => {
        if (d) setCode(d);
      })
      .catch(() => undefined);
  }, [exercise]);

  return (
    <section aria-labelledby={`explain-${exercise}`} data-pagefind-ignore data-explain={exercise}>
      <h2 id={`explain-${exercise}`}>Explain back</h2>
      <p>
        Claude will interview you about your own code, one question at a time. It will not give you
        the answers. Your saved draft is filled in below; edit it if you changed your solution.
      </p>
      <label>
        Your code or answer
        <br />
        <textarea
          rows={10}
          cols={70}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
        />
      </label>
      <PromptCopy
        label="Copy the prompt and open Claude"
        prompt={explainBackPrompt({ track, objectives, code })}
        onDelivered={() => setDelivered(true)}
      />
      {delivered && (
        <SessionLog
          kind="explain"
          scoreLabels={SCORE_LABELS.explain}
          competencies={competencies}
          lessonId={lesson}
          exerciseId={exercise}
        />
      )}
    </section>
  );
}
