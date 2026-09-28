import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, artistLink, mentorLink } from '../lib/api';
import { prepareImage, titleFromFilename } from '../lib/image';
import { rememberSelection } from '../lib/recent';
import type { Selection, Work, WorkDetails } from '../lib/types';
import { Layout } from '../components/Layout';
import { Feedback } from '../components/Feedback';
import { Lightbox } from '../components/Lightbox';
import { SortableList, move } from '../components/Sortable';
import { CenterState, SavedFlag, StatusPill, copyText, useToast, workCaption } from '../components/bits';
import { DownIcon, GripIcon, LockIcon, MailIcon, TrashIcon, UpIcon, UploadIcon } from '../components/Icons';

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
interface Upload {
  key: string;
  name: string;
  state: 'working' | 'failed';
  error?: string;
}

export function Artist() {
  const { token = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const isNew = params.get('new') === '1';

  const [sel, setSel] = useState<Selection | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'works' | 'feedback'>('works');
  const [save, setSave] = useState<SaveState>('idle');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const { toast, show } = useToast();

  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef(new Map<string, WorkDetails>());
  const timers = useRef(new Map<string, number>());
  const saving = useRef(0);

  // ---------- loading ----------

  const refresh = useCallback(async () => {
    const s = await api.getArtistView(token);
    if (!s) {
      setMissing(true);
      return null;
    }
    setSel((prev) =>
      prev
        ? { ...s, title: prev.title, artist_name: prev.artist_name, purpose: prev.purpose }
        : s,
    );
    // keep any edits that haven't been saved yet
    setWorks(s.works.map((w) => ({ ...w, ...(pending.current.get(w.id) ?? {}) })));
    return s;
  }, [token]);

  useEffect(() => {
    let alive = true;
    api
      .getArtistView(token)
      .then((s) => {
        if (!alive) return;
        if (!s) return setMissing(true);
        setSel(s);
        setWorks(s.works);
        if (s.status === 'reviewed') setTab('feedback');
        rememberSelection(token, s.title);
      })
      .catch((e) => alive && setLoadError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [token]);

  // ---------- saving helpers ----------

  const track = useCallback(async (p: Promise<unknown>) => {
    saving.current++;
    setSave('saving');
    try {
      await p;
      saving.current--;
      if (saving.current === 0) setSave('saved');
    } catch (e) {
      saving.current--;
      setSave('error');
      show((e as Error).message);
    }
  }, [show]);

  const debounce = useCallback((key: string, fn: () => void, ms = 700) => {
    window.clearTimeout(timers.current.get(key));
    setSave('saving');
    timers.current.set(key, window.setTimeout(() => {
      timers.current.delete(key);
      fn();
    }, ms));
  }, []);

  // Save anything pending if the page is closed mid-edit.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (timers.current.size > 0 || saving.current > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  function editSelection(patch: Partial<Pick<Selection, 'title' | 'artist_name' | 'purpose'>>) {
    if (!sel) return;
    const next = { ...sel, ...patch };
    setSel(next);
    debounce('selection', () => {
      track(api.updateSelection(token, { title: next.title, artistName: next.artist_name, purpose: next.purpose }));
      if (next.title.trim()) rememberSelection(token, next.title);
    });
  }

  function editWork(id: string, patch: Partial<WorkDetails>) {
    const current = works.find((x) => x.id === id);
    if (!current) return;
    const w = { ...current, ...patch };
    setWorks((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    pending.current.set(id, { title: w.title, year: w.year, medium: w.medium, dimensions: w.dimensions });
    debounce(`work:${id}`, () => {
      const latest = pending.current.get(id);
      pending.current.delete(id);
      if (latest) track(api.updateWork(token, id, latest));
    });
  }

  // When the artist comes back to the tab, check whether feedback has arrived.
  useEffect(() => {
    const onFocus = () => {
      if (timers.current.size === 0 && saving.current === 0) refresh().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  function reorder(next: Work[]) {
    setWorks(next.map((w, i) => ({ ...w, position: i })));
    track(api.reorderWorks(token, next.map((w) => w.id)));
  }

  async function remove(w: Work) {
    if (!window.confirm(`Remove "${w.title || 'this work'}" from the selection?`)) return;
    setWorks((list) => list.filter((x) => x.id !== w.id));
    pending.current.delete(w.id);
    window.clearTimeout(timers.current.get(`work:${w.id}`));
    timers.current.delete(`work:${w.id}`);
    await track(api.deleteWork(token, w.id));
  }

  // ---------- uploading ----------

  async function addFiles(files: FileList | File[]) {
    if (!sel) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (list.length === 0) {
      show('Those files aren’t images. Use JPG, PNG or WebP.');
      return;
    }
    const room = 40 - works.length;
    if (room <= 0) {
      show('A selection can hold up to 40 works.');
      return;
    }
    const batch = list.slice(0, room);
    if (list.length > room) show(`Only ${room} more can be added. A selection holds up to 40 works.`);

    const rows: Upload[] = batch.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, state: 'working' }));
    setUploads((u) => [...u, ...rows]);

    // upload two at a time, in the order chosen
    let cursor = 0;
    const worker = async () => {
      while (cursor < batch.length) {
        const i = cursor++;
        const f = batch[i];
        const key = rows[i].key;
        try {
          const img = await prepareImage(f);
          await api.addWork(token, sel.id, img, titleFromFilename(f.name));
          setUploads((u) => u.filter((x) => x.key !== key));
          await refresh();
        } catch (e) {
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, state: 'failed', error: (e as Error).message } : x)));
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setSave('saved');
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  // ---------- render ----------

  if (missing) {
    return (
      <Layout>
        <CenterState title="We couldn’t find that selection">
          <p>The link may be incomplete. Check that you copied the whole address, or start a new selection.</p>
          <Link className="btn" to="/">Start a new selection</Link>
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
          <div className="skeleton" style={{ height: 52, width: '50%' }} />
          <div className="skeleton" style={{ height: 20, width: '30%', marginTop: 16 }} />
          <div className="skeleton" style={{ height: 180, marginTop: 40 }} />
        </div>
      </Layout>
    );
  }

  const mLink = sel.mentor_token ? mentorLink(sel.mentor_token) : '';
  const aLink = artistLink(token);
  const mailto =
    `mailto:?subject=${encodeURIComponent(`Would you take a second look at my work? — ${sel.title}`)}` +
    `&body=${encodeURIComponent(
      `Hi,\n\nI'm putting together "${sel.title}" and would really value your eye on it. ` +
        `Could you mark each work keep, maybe or cut and leave a quick note?\n\n${mLink}\n\n` +
        `It takes about 15 minutes and you don't need an account.\n\nThank you,\n${sel.artist_name}`,
    )}`;
  const hasFeedback = sel.status === 'reviewed';

  return (
    <Layout note={<SavedFlag state={save} />}>
      <div className="wrap">
        <div className="page-head">
          <div className="page-head-row">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="eyebrow">Your selection</div>
              <label className="sr-only" htmlFor="sel-title">Selection title</label>
              <textarea
                id="sel-title"
                className="title-input"
                rows={1}
                value={sel.title}
                ref={(el) => autoGrow(el)}
                onChange={(e) => {
                  autoGrow(e.target);
                  editSelection({ title: e.target.value.replace(/\n/g, ' ') });
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                maxLength={140}
                style={{ marginTop: 10 }}
              />
              <div className="meta-row">
                <label className="sr-only" htmlFor="sel-name">Your name</label>
                <input
                  id="sel-name"
                  className="input input-quiet"
                  value={sel.artist_name}
                  onChange={(e) => editSelection({ artist_name: e.target.value })}
                  placeholder="Your name"
                  size={Math.max(10, sel.artist_name.length + 1)}
                  maxLength={120}
                />
                <span className="muted hide-mobile">·</span>
                <label className="sr-only" htmlFor="sel-purpose">What it's for</label>
                <input
                  id="sel-purpose"
                  className="input input-quiet"
                  value={sel.purpose}
                  onChange={(e) => editSelection({ purpose: e.target.value })}
                  placeholder="What it’s for"
                  size={Math.max(12, sel.purpose.length + 1)}
                  maxLength={140}
                />
              </div>
            </div>
            <StatusPill status={sel.status} />
          </div>
        </div>

        <div className="notice" role="note">
          <LockIcon />
          <div>
            <strong>{isNew ? 'Bookmark this page.' : 'This is your private editing link.'}</strong>{' '}
            It's the only way back to this selection, so save it somewhere.{' '}
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 6, verticalAlign: 'middle' }}
              onClick={async () => {
                if (await copyText(aLink)) show('Your editing link is copied');
                if (isNew) setParams({}, { replace: true });
              }}
            >
              Copy my link
            </button>
          </div>
        </div>

        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={tab === 'works'} onClick={() => setTab('works')}>
            Works <span className="tab-count">{works.length}</span>
          </button>
          <button
            className="tab"
            role="tab"
            aria-selected={tab === 'feedback'}
            onClick={() => setTab('feedback')}
          >
            Feedback {hasFeedback && <span className="tab-dot" aria-label="ready" />}
          </button>
        </div>

        {tab === 'feedback' ? (
          hasFeedback ? (
            <Feedback selection={sel} />
          ) : (
            <div className="empty">
              <h3>No feedback yet</h3>
              <p style={{ margin: 0 }}>
                {sel.status === 'in_review'
                  ? 'Your mentor has started reviewing. Their notes appear here as soon as they press Send.'
                  : 'Send the review link to a mentor. Their notes will appear here once they’re done.'}
              </p>
            </div>
          )
        ) : (
          <div className="editor-grid">
            <div>
              <div
                className={`dropzone ${over ? 'over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                onClick={() => fileInput.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput.current?.click();
                  }
                }}
                aria-label="Add images"
              >
                <h3>{works.length ? 'Add more works' : 'Add the works you’re considering'}</h3>
                <p>Drag images here, or choose files. JPG, PNG or WebP · up to 40 works.</p>
                <span className="btn btn-ghost btn-sm" aria-hidden="true">
                  <UploadIcon /> Choose images
                </span>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={onPick}
                />
              </div>

              {uploads.length > 0 && (
                <div className="uploads" aria-live="polite">
                  {uploads.map((u) => (
                    <div className={`upload-row ${u.state}`} key={u.key}>
                      {u.state === 'working' ? <span className="spinner" /> : null}
                      <span className="name">{u.state === 'failed' ? u.error : u.name}</span>
                      {u.state === 'failed' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {works.length === 0 && uploads.length === 0 ? null : (
                <>
                  {works.length > 1 && (
                    <p className="muted small" style={{ margin: '22px 0 0' }}>
                      Drag to put them in the order you’d send them.
                    </p>
                  )}
                  <SortableList
                    items={works}
                    onReorder={reorder}
                    className="work-list"
                    render={(w, i, handle, dragging) => (
                      <div className={`work-row ${dragging ? 'dragging' : ''}`}>
                        <button
                          className="handle"
                          {...handle.attributes}
                          {...handle.listeners}
                          aria-label={`Drag to reorder ${w.title || 'work'} (currently #${i + 1})`}
                        >
                          <span className="handle-num">{i + 1}</span>
                          <GripIcon />
                        </button>
                        <button className="thumb" onClick={() => setOpen(i)} aria-label={`View ${w.title || 'work'} larger`}>
                          <img src={api.imageUrl(w.image_path)} alt={w.title || 'Artwork'} loading="lazy" />
                        </button>
                        <div className="work-fields">
                          <div className="field span-2 title-field">
                            <label htmlFor={`t-${w.id}`} className="sr-only">Title</label>
                            <input
                              id={`t-${w.id}`}
                              className="input"
                              value={w.title}
                              placeholder="Title"
                              maxLength={200}
                              onChange={(e) => editWork(w.id, { title: e.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`y-${w.id}`} className="sr-only">Year</label>
                            <input
                              id={`y-${w.id}`}
                              className="input"
                              value={w.year}
                              placeholder="Year"
                              maxLength={40}
                              onChange={(e) => editWork(w.id, { year: e.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`d-${w.id}`} className="sr-only">Dimensions</label>
                            <input
                              id={`d-${w.id}`}
                              className="input"
                              value={w.dimensions}
                              placeholder="Size, e.g. 30 × 24 in"
                              maxLength={120}
                              onChange={(e) => editWork(w.id, { dimensions: e.target.value })}
                            />
                          </div>
                          <div className="field span-2">
                            <label htmlFor={`m-${w.id}`} className="sr-only">Medium</label>
                            <input
                              id={`m-${w.id}`}
                              className="input"
                              value={w.medium}
                              placeholder="Medium, e.g. Oil on linen"
                              maxLength={200}
                              onChange={(e) => editWork(w.id, { medium: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="row-actions">
                          <button className="icon-btn" disabled={i === 0} onClick={() => reorder(move(works, i, i - 1))} aria-label="Move up">
                            <UpIcon />
                          </button>
                          <button
                            className="icon-btn"
                            disabled={i === works.length - 1}
                            onClick={() => reorder(move(works, i, i + 1))}
                            aria-label="Move down"
                          >
                            <DownIcon />
                          </button>
                          <button className="icon-btn" onClick={() => remove(w)} aria-label={`Remove ${w.title || 'work'}`}>
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    )}
                  />
                </>
              )}
            </div>

            <aside className="sidebar">
              <div className="card">
                <h3>Send it for a second look</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  Anyone with this link can review the selection. They can’t change your works, and you’ll see their
                  notes here when they press Send.
                </p>
                <div className="copy-field">
                  <label className="sr-only" htmlFor="mentor-link">Review link</label>
                  <input id="mentor-link" className="input" readOnly value={mLink} onFocus={(e) => e.target.select()} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-sm"
                    disabled={works.length === 0}
                    onClick={async () => {
                      if (await copyText(mLink)) show('Review link copied');
                    }}
                  >
                    Copy review link
                  </button>
                  <a className="btn btn-ghost btn-sm" href={mailto} aria-disabled={works.length === 0}>
                    <MailIcon /> Email it
                  </a>
                </div>
                {works.length === 0 && (
                  <p className="muted small" style={{ margin: '12px 0 0' }}>
                    Add at least one work before you send it.
                  </p>
                )}
              </div>
              <div className="card tips">
                <h3>Tips for a useful review</h3>
                <ul className="small muted" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  <li>Include a few more works than you need, so there’s something to cut.</li>
                  <li>Fill in size and medium. Scale changes how a work reads.</li>
                  <li>Put your current favorite first and see if they agree.</li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </div>

      {open !== null && (
        <Lightbox
          items={works.map((w) => ({ src: api.imageUrl(w.image_path), title: w.title, caption: workCaption(w) }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
      {toast}
    </Layout>
  );
}
