import { useEffect, useRef, useState } from 'react';
import type { Status, Verdict, Work } from '../lib/types';
import { CheckIcon } from './Icons';

export const VERDICT_LABEL: Record<Verdict, string> = {
  keep: 'Keep',
  maybe: 'Maybe',
  cut: 'Cut',
};

export function VerdictTag({ v }: { v: Verdict | null }) {
  if (!v) return <span className="verdict none">Not marked</span>;
  return <span className={`verdict ${v}`}>{VERDICT_LABEL[v]}</span>;
}

export function VerdictPicker({
  value,
  onChange,
  label,
}: {
  value: Verdict | null;
  onChange: (v: Verdict | null) => void;
  label: string;
}) {
  return (
    <div className="picker" role="group" aria-label={label}>
      {(['keep', 'maybe', 'cut'] as Verdict[]).map((v) => (
        <button
          key={v}
          type="button"
          className={v}
          aria-pressed={value === v}
          onClick={() => onChange(value === v ? null : v)}
        >
          {value === v && <CheckIcon />}
          {VERDICT_LABEL[v]}
        </button>
      ))}
    </div>
  );
}

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Not reviewed yet',
  in_review: 'Mentor is reviewing',
  reviewed: 'Feedback ready',
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`pill ${status}`}>
      <span className="pill-dot" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SavedFlag({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null;
  const text = state === 'saving' ? 'Saving…' : state === 'saved' ? 'All changes saved' : 'Not saved — check your connection';
  return (
    <span className={`saved-flag ${state}`} role="status" aria-live="polite">
      {text}
    </span>
  );
}

export function workCaption(w: Pick<Work, 'year' | 'medium' | 'dimensions'>) {
  return [w.year, w.medium, w.dimensions].filter(Boolean).join(' · ');
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number>();
  useEffect(() => () => window.clearTimeout(t.current), []);
  return {
    toast: msg ? <div className="toast" role="status">{msg}</div> : null,
    show(m: string) {
      setMsg(m);
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setMsg(null), 2400);
    },
  };
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function CenterState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="center-state">
      <h1>{title}</h1>
      {children}
    </div>
  );
}
