import { useMemo, useState } from 'react';
import type { Selection, Work } from '../lib/types';
import { api } from '../lib/api';
import { VerdictTag, workCaption } from './bits';
import { Lightbox } from './Lightbox';

export function orderForMentor(works: Work[]) {
  return [...works].sort((a, b) => {
    const am = a.mentor_position ?? Number.MAX_SAFE_INTEGER;
    const bm = b.mentor_position ?? Number.MAX_SAFE_INTEGER;
    return am - bm || a.position - b.position;
  });
}

export function Feedback({ selection }: { selection: Selection }) {
  const [open, setOpen] = useState<number | null>(null);

  const ordered = useMemo(() => orderForMentor(selection.works), [selection.works]);
  const artistRank = useMemo(() => {
    const m = new Map<string, number>();
    [...selection.works].sort((a, b) => a.position - b.position).forEach((w, i) => m.set(w.id, i + 1));
    return m;
  }, [selection.works]);

  const counts = {
    keep: ordered.filter((w) => w.verdict === 'keep').length,
    maybe: ordered.filter((w) => w.verdict === 'maybe').length,
    cut: ordered.filter((w) => w.verdict === 'cut').length,
  };
  const mentor = selection.mentor_name || 'Your mentor';
  const when = selection.reviewed_at
    ? new Date(selection.reviewed_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : '';

  return (
    <div>
      <div className="eyebrow">
        Feedback from {mentor}
        {when && ` · ${when}`}
      </div>
      <div className="summary" style={{ marginTop: 14 }}>
        <span className="verdict keep">{counts.keep} Keep</span>
        <span className="verdict maybe">{counts.maybe} Maybe</span>
        <span className="verdict cut">{counts.cut} Cut</span>
      </div>

      {selection.overall_note.trim() && (
        <>
          <blockquote className="quote">{selection.overall_note}</blockquote>
          <div className="quote-by">— {mentor}</div>
        </>
      )}

      <p className="muted small" style={{ marginTop: 28 }}>
        Shown in the order {mentor === 'Your mentor' ? 'your mentor' : mentor} would present them.
      </p>

      <div className="fb-list">
        {ordered.map((w, i) => {
          const was = artistRank.get(w.id) ?? i + 1;
          return (
            <article className={`fb-row ${w.verdict ? `v-${w.verdict}` : ''}`} key={w.id}>
              <div className="fb-rank">
                {i + 1}
                {was !== i + 1 && (
                  <small>
                    you had it
                    <br />
                    at #{was}
                  </small>
                )}
              </div>
              <button className="fb-img" onClick={() => setOpen(i)} aria-label={`View ${w.title || 'work'} larger`}>
                <img src={api.imageUrl(w.image_path)} alt={w.title || 'Artwork'} loading="lazy" />
              </button>
              <div className="fb-text">
                <div>
                  <VerdictTag v={w.verdict} />
                </div>
                <h3>{w.title || <span className="italic muted">Untitled</span>}</h3>
                {workCaption(w) && <div className="review-meta">{workCaption(w)}</div>}
                {w.note.trim() ? (
                  <p className="fb-note">{w.note}</p>
                ) : (
                  <p className="fb-note empty-note">No note on this one.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {open !== null && (
        <Lightbox
          items={ordered.map((w) => ({ src: api.imageUrl(w.image_path), title: w.title, caption: workCaption(w) }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
