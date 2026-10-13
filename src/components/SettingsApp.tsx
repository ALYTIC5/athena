import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  createDefault,
  exportFileName,
  importData,
  isMonday,
  load,
  needsExportBanner,
  reset,
  serialise,
  subscribe,
  update,
  type ImportMode,
  type LearnerData,
  type LoadResult,
} from '../lib/store/store';

function download(name: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}

export function SettingsApp() {
  const [state, setState] = useState<LoadResult | null>(null);
  const [message, setMessage] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [persisted, setPersisted] = useState<boolean | undefined>(undefined);

  const refresh = useCallback(() => setState(load(window.localStorage)), []);

  useEffect(() => {
    refresh();
    const off = subscribe(window, refresh);
    if (navigator.storage?.persist) {
      void navigator.storage.persist().then((ok) => {
        setPersisted(ok);
        try {
          update(window.localStorage, new Date(), (d) => ({
            ...d,
            settings: { ...d.settings, persistentStorage: ok },
          }));
        } catch {
          // corrupt data: the recovery screen handles it
        }
      });
    }
    return off;
  }, [refresh]);

  if (state === null) return <p>Loading settings…</p>;

  if (state.status === 'corrupt') {
    return (
      <section aria-labelledby="recover-h">
        <h2 id="recover-h">Your saved data could not be read</h2>
        <p>{state.error} Nothing has been changed. Download the raw data first, then reset.</p>
        <p>
          <button type="button" onClick={() => download('athena-corrupt-data.json', state.raw)}>
            Download raw data
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Delete the unreadable data and start fresh?')) {
                reset(window.localStorage);
                refresh();
              }
            }}
          >
            Reset and start fresh
          </button>
        </p>
      </section>
    );
  }

  const data: LearnerData = state.status === 'ok' ? state.data : createDefault(new Date());
  const s = data.settings;

  const save = (fn: (d: LearnerData) => LearnerData, ok: string) => {
    try {
      update(window.localStorage, new Date(), (d) => {
        const next = fn(d);
        return { ...next, settings: { ...next.settings, updatedAt: new Date().toISOString() } };
      });
      setMessage(ok);
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const startDate = String(f.get('startDate') ?? '');
    if (startDate !== '' && !isMonday(startDate)) {
      setMessage('The start date must be a Monday.');
      return;
    }
    const hours = Number(f.get('hoursPerWeek'));
    const reviews = Number(f.get('reviews'));
    const newCards = Number(f.get('newCards'));
    if (!(hours > 0 && hours <= 40) || !Number.isInteger(reviews) || !Number.isInteger(newCards)) {
      setMessage('Check hours per week (1 to 40) and the review caps (whole numbers).');
      return;
    }
    save((d) => {
      const rest = { ...d.settings };
      delete rest.startDate;
      return {
        ...d,
        settings: {
          ...rest,
          ...(startDate === '' ? {} : { startDate }),
          hoursPerWeek: hours,
          jobTrack: String(f.get('jobTrack') ?? ''),
          reviewCaps: { reviews, newCards },
          shortcutsEnabled: f.get('shortcutsEnabled') === 'on',
        },
      };
    }, 'Settings saved.');
  };

  const onExport = () => {
    const current = load(window.localStorage);
    const toExport = current.status === 'ok' ? current.data : createDefault(new Date());
    download(exportFileName(new Date()), serialise(toExport));
    save(
      (d) => ({ ...d, settings: { ...d.settings, lastExportAt: new Date().toISOString() } }),
      'Progress exported.',
    );
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = importData(window.localStorage, await file.text(), importMode);
    setMessage(result.ok ? `Import complete (${importMode}).` : `Import failed: ${result.error}`);
    refresh();
  };

  const onReset = () => {
    if (window.confirm('Delete all progress in this browser? Export first if unsure.')) {
      reset(window.localStorage);
      setMessage('All data reset.');
      refresh();
    }
  };

  return (
    <div>
      {needsExportBanner(data, new Date()) && (
        <p role="note" data-testid="export-banner">
          <strong>Back up your progress.</strong> You have not exported in over 7 days. Safari can
          delete site data after seven days without a visit.
        </p>
      )}
      <p role="status" aria-live="polite" data-testid="status">
        {message}
      </p>

      <form onSubmit={onSubmit} key={s.updatedAt}>
        <p>
          <label>
            Start date (a Monday){' '}
            <input type="date" name="startDate" defaultValue={s.startDate ?? ''} />
          </label>
        </p>
        <p>
          <label>
            Hours per week{' '}
            <input
              type="number"
              name="hoursPerWeek"
              min={1}
              max={40}
              step="0.5"
              defaultValue={s.hoursPerWeek}
            />
          </label>
        </p>
        <p>
          <label>
            Job track <input type="text" name="jobTrack" defaultValue={s.jobTrack} />
          </label>
        </p>
        <p>
          <label>
            Daily review cap{' '}
            <input type="number" name="reviews" min={0} defaultValue={s.reviewCaps.reviews} />
          </label>{' '}
          <label>
            New cards per day{' '}
            <input type="number" name="newCards" min={0} defaultValue={s.reviewCaps.newCards} />
          </label>
        </p>
        <p>
          <label>
            <input type="checkbox" name="shortcutsEnabled" defaultChecked={s.shortcutsEnabled} />{' '}
            Keyboard shortcuts on
          </label>
        </p>
        <p>
          <button type="submit">Save settings</button>
        </p>
      </form>

      <h2>Storage</h2>
      <p data-testid="storage-status">
        Persistent storage:{' '}
        {(persisted ?? s.persistentStorage) === undefined
          ? 'not requested yet'
          : (persisted ?? s.persistentStorage)
            ? 'granted'
            : 'not granted (export regularly)'}
        . Last export: {s.lastExportAt ? s.lastExportAt.slice(0, 10) : 'never'}.
      </p>

      <h2>Backup</h2>
      <p>
        <button type="button" onClick={onExport}>
          Export progress
        </button>
      </p>
      <fieldset>
        <legend>Import progress</legend>
        <label>
          <input
            type="radio"
            name="mode"
            checked={importMode === 'merge'}
            onChange={() => setImportMode('merge')}
          />{' '}
          Merge with current data
        </label>{' '}
        <label>
          <input
            type="radio"
            name="mode"
            checked={importMode === 'replace'}
            onChange={() => setImportMode('replace')}
          />{' '}
          Replace current data
        </label>
        <p>
          <label>
            Choose a progress file{' '}
            <input type="file" accept="application/json,.json" onChange={onImport} />
          </label>
        </p>
      </fieldset>

      <h2>Reset</h2>
      <p>
        <button type="button" onClick={onReset}>
          Reset all data
        </button>
      </p>
    </div>
  );
}
