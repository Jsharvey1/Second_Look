import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Selection, Verdict, Work } from '../lib/types';
import { Layout } from '../components/Layout';
import { Lightbox } from '../components/Lightbox';
import { SortableList, move } from '../components/Sortable';
import { orderForMentor } from '../components/Feedback';
import { CenterState, SavedFlag, VerdictPicker, useToast, workCaption } from '../components/bits';
import { CheckIcon, DownIcon, GripIcon, UpIcon } from '../components/Icons';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function Mentor() {
  const { token = '' } = useParams();
  const [sel, setSel] = useState<Selection | null>(null);
  const [items, setItems] = useState<Work[]>([]);
  const [mentorName, setMentorName] = useState('');
  const [overall, setOverall] = useState('');
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>('idle');
  const [sending, setSending] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const { toast, show } = useToast();

  const timer = useRef<number>();
  const dirty = useRef(false);
  const latest = useRef({ items, mentorName, overall });
  latest.current = { items, mentorName, overall };

  useEffect(() => {
    let alive = true;
    api
      .getMentorView(token)
      .then((s) => {
        if (!alive) return;
        if (!s) return setMissing(true);
        setSel(s);
        setItems(orderForMentor(s.works));
        setMentorName(s.mentor_name);
        setOverall(s.overall_note);
      })
      .catch((e) => alive && setLoadError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [token]);

  const persist = useCallback(
    async (submit: boolean) => {
      const { items, mentorName, overall } = latest.current;
      setSave('saving');
      const s = await api.saveReview(token, {
        mentorName,
        overallNote: overall,
        submit,
        items: items.map((w, i) => ({ id: w.id, verdict: w.verdict, note: w.note, position: i })),
      });
      dirty.current = false;
      setSel((prev) => (prev ? { ...prev, status: s.status, reviewed_at: s.reviewed_at } : s));
      setSave('saved');
      return s;
    },
    [token],
  );

  const schedule = useCallback(() => {
    dirty.current = true;
    setSave('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      persist(false).catch((e) => {
        setSave('error');
        show((e as Error).message);
      });
    }, 900);
  }, [persist, show]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.clearTimeout(timer.current);
    };
  }, []);

  function setVerdict(id: string, v: Verdict | null) {
    setItems((list) => list.map((w) => (w.id === id ? { ...w, verdict: v } : w)));
    schedule();
  }
  function setNote(id: string, note: string) {
    setItems((list) => list.map((w) => (w.id === id ? { ...w, note } : w)));
    schedule();
  }
  function reorder(next: Work[]) {
    setItems(next);
    schedule();
  }

  async function send() {
    if (!mentorName.trim()) {
      setNameError(true);
      document.getElementById('mentor-name')?.focus();
      document.getElementById('mentor-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const unmarked = items.filter((w) => !w.verdict).length;
    if (
      unmarked > 0 &&
      !window.confirm(
        `${unmarked} ${unmarked === 1 ? 'work isn’t' : 'works aren’t'} marked yet. Send your feedback anyway?`,
      )
    ) {
      return;
    }
    window.clearTimeout(timer.current);
    setSending(true);
    try {
      await persist(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      show(`Sent to ${sel?.artist_name || 'the artist'}`);
    } catch (e) {
      setSave('error');
      show((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (missing) {
    return (
      <Layout>
        <CenterState title="We couldn’t find that review">
          <p>The link may be incomplete. Ask the artist to send it again, and make sure you copy the whole address.</p>
          <Link className="btn btn-ghost" to="/">About Second Look</Link>
        </CenterState>
      </Layout>
    );
  }
  if (loadError) {
    return (
      <Layout>
        <CenterState title="Something went wrong">
          <p>{loadError}</p>
          <button className="btn" onClick={() => window.location.reload()}>Try again</button>
        </CenterState>
      </Layout>
    );
  }
  if (!sel) {
    return (
      <Layout>
        <div className="wrap" style={{ paddingTop: 48 }}>
          <div className="skeleton" style={{ height: 22, width: '25%' }} />
          <div className="skeleton" style={{ height: 56, width: '60%', marginTop: 16 }} />
          <div className="skeleton" style={{ height: 360, marginTop: 40 }} />
        </div>
      </Layout>
    );
  }

  const artist = sel.artist_name || 'The artist';
  const marked = items.filter((w) => w.verdict).length;
  const sent = sel.status === 'reviewed';

  return (
    <Layout note={<SavedFlag state={save} />}>
      <div className="wrap">
        <section className="review-intro">
          <div className="eyebrow">
            A second look for {artist}
            {sel.purpose && ` · ${sel.purpose}`}
          </div>
          <h1>{sel.title}</h1>
          <p className="lede">
            {artist} is deciding which works to send and would value your eye. It usually takes about fifteen
            minutes.
          </p>

          {sent && (
            <div className="sent-banner" role="status">
              <CheckIcon />
              <div>
                <strong>Your feedback has been sent.</strong> {artist} can see it now. Any changes you make here update
                what they see.
              </div>
            </div>
          )}

          <div className="how">
            <div>
              <b>Mark each work</b>
              Keep, Maybe or Cut.
            </div>
            <div>
              <b>Leave a note</b>
              A sentence on why is plenty.
            </div>
            <div>
              <b>Put them in order</b>
              Drag works into the order you’d show them.
            </div>
          </div>

          <div className="name-row">
            <div className="field">
              <label htmlFor="mentor-name">Your name, as {artist} will see it</label>
              <input
                id="mentor-name"
                className="input"
                value={mentorName}
                placeholder="e.g. Jen Samuels, Director at …"
                maxLength={120}
                aria-invalid={nameError}
                onChange={(e) => {
                  setMentorName(e.target.value);
                  setNameError(false);
                  schedule();
                }}
              />
            </div>
            {nameError && <span className="error-text">Add your name before sending.</span>}
          </div>
        </section>

        {items.length === 0 ? (
          <div className="empty" style={{ marginTop: 28 }}>
            <h3>No works yet</h3>
            <p style={{ margin: 0 }}>{artist} hasn’t added any works to this selection. Check back soon.</p>
          </div>
        ) : (
          <SortableList
            items={items}
            onReorder={reorder}
            className="review-list"
            render={(w, i, handle, dragging) => (
              <article
                className={`review-card ${dragging ? 'dragging' : ''} ${w.verdict ? `v-${w.verdict}` : ''}`}
                aria-label={`Work ${i + 1}: ${w.title || 'Untitled'}`}
              >
                <button className="review-image" onClick={() => setOpen(i)} aria-label={`View ${w.title || 'work'} full screen`}>
                  <img src={api.imageUrl(w.image_path)} alt={w.title || 'Artwork'} loading="lazy" />
                </button>
                <div className="review-body">
                  <div className="review-top">
                    <div>
                      <div className="review-num">Your #{i + 1}</div>
                      <div className="review-title">{w.title || <span className="italic muted">Untitled</span>}</div>
                      {workCaption(w) && <div className="review-meta">{workCaption(w)}</div>}
                    </div>
                    <div className="review-order">
                      <button className="icon-btn" disabled={i === 0} onClick={() => reorder(move(items, i, i - 1))} aria-label="Move up">
                        <UpIcon />
                      </button>
                      <button
                        className="icon-btn"
                        disabled={i === items.length - 1}
                        onClick={() => reorder(move(items, i, i + 1))}
                        aria-label="Move down"
                      >
                        <DownIcon />
                      </button>
                      <button
                        className="icon-btn handle"
                        style={{ padding: 0 }}
                        {...handle.attributes}
                        {...handle.listeners}
                        aria-label={`Drag to reorder (currently #${i + 1})`}
                      >
                        <GripIcon />
                      </button>
                    </div>
                  </div>
                  <VerdictPicker value={w.verdict} onChange={(v) => setVerdict(w.id, v)} label={`Verdict for ${w.title || 'this work'}`} />
                  <div className="field">
                    <label htmlFor={`note-${w.id}`}>Note for {artist}</label>
                    <textarea
                      id={`note-${w.id}`}
                      className="textarea"
                      value={w.note}
                      maxLength={4000}
                      placeholder={
                        w.verdict === 'cut'
                          ? 'Why leave it out?'
                          : w.verdict === 'keep'
                            ? 'What makes it work?'
                            : 'What would you tell them about this one?'
                      }
                      onChange={(e) => setNote(w.id, e.target.value)}
                    />
                  </div>
                </div>
              </article>
            )}
          />
        )}

        {items.length > 0 && (
          <section className="overall wrap-narrow" style={{ padding: 0, maxWidth: 820 }}>
            <div className="field">
              <label htmlFor="overall" style={{ fontSize: 15 }}>
                Overall thoughts on the selection
              </label>
              <textarea
                id="overall"
                className="textarea"
                value={overall}
                maxLength={8000}
                placeholder="How does the group hold together? Anything missing, or anything you’d add from their other work?"
                onChange={(e) => {
                  setOverall(e.target.value);
                  schedule();
                }}
              />
            </div>
          </section>
        )}
      </div>

      {items.length > 0 && (
        <div className="sticky-bar">
          <div className="sticky-inner">
            <div className="progress">
              <div className="progress-bar" aria-hidden="true">
                <span style={{ width: `${(marked / items.length) * 100}%` }} />
              </div>
              <span>
                {marked} of {items.length} marked
              </span>
            </div>
            <button className="btn" onClick={send} disabled={sending}>
              {sending ? 'Sending…' : sent ? 'Update feedback' : 'Send feedback'}
              {!sending && <span className="hide-mobile">{sent ? ` for ${artist}` : ` to ${artist}`}</span>}
            </button>
          </div>
        </div>
      )}

      {open !== null && (
        <Lightbox
          items={items.map((w) => ({ src: api.imageUrl(w.image_path), title: w.title, caption: workCaption(w) }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
      {toast}
    </Layout>
  );
}
