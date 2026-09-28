import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Layout } from '../components/Layout';
import { getRecent } from '../lib/recent';

const PURPOSES = [
  'Grant or fellowship application',
  'Residency application',
  'Gallery submission',
  'Upcoming show',
  'Portfolio update',
  'General feedback',
];

const PREVIEW = [
  {
    v: 'keep',
    label: 'Keep',
    note: 'Lead with this one.',
    bg: 'radial-gradient(circle at 30% 35%, #d9a441 0 14%, transparent 15%), linear-gradient(160deg, #2f4858 0%, #3d6272 55%, #c9b99a 56%, #b8a684 100%)',
  },
  {
    v: 'maybe',
    label: 'Maybe',
    note: 'Strong, but close to #1.',
    bg: 'linear-gradient(90deg, #e9e1d0 0 38%, #9b3d2b 38% 44%, #e9e1d0 44% 100%), linear-gradient(#e9e1d0, #cfc3aa)',
  },
  {
    v: 'cut',
    label: 'Cut',
    note: 'Save it for the next show.',
    bg: 'radial-gradient(ellipse at 60% 70%, #6f7d5c 0 30%, transparent 31%), linear-gradient(180deg, #d7d2c4 0 58%, #8b8c6d 58% 100%)',
  },
];

export function Home() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent] = useState(getRecent);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Add your name so your mentor knows whose work this is.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await api.createSelection({ title, artistName: name, purpose });
      nav(`/a/${token}?new=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Layout note="For artists getting feedback before a deadline">
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">Before you send it out</div>
            <h1>
              Get a <em>second look</em> at your work from someone who knows.
            </h1>
            <p className="lede">
              Put together the works you're thinking of sending, share one link with a mentor, and get a clear
              keep, maybe or cut on every piece, with a note on why and the order they'd show them in.
            </p>

            <div className="preview-strip" aria-hidden="true">
              {PREVIEW.map((p, i) => (
                <div className="preview-tile" key={p.v}>
                  <div className="preview-art" style={{ background: p.bg }} />
                  <div className="preview-meta">
                    <span className={`verdict ${p.v}`}>{p.label}</span>
                    <div className="muted">
                      #{i + 1} · {p.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form className="card form-stack" onSubmit={submit} aria-labelledby="start-heading">
            <div>
              <h2 id="start-heading" style={{ fontSize: 30 }}>
                Start a selection
              </h2>
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                No account needed. You'll get a private link to come back to.
              </p>
            </div>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Maya Chen"
                autoComplete="name"
                maxLength={120}
              />
            </div>
            <div className="field">
              <label htmlFor="title">What should we call this selection?</label>
              <input
                id="title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Greenshields application, Fall 2026"
                maxLength={140}
              />
            </div>
            <div className="field">
              <label htmlFor="purpose">What's it for?</label>
              <select id="purpose" className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {PURPOSES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            {error && (
              <div className="error-text" role="alert">
                {error}
              </div>
            )}
            <button className="btn btn-lg" disabled={busy}>
              {busy ? 'Creating…' : 'Start and add works'}
            </button>
          </form>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="wrap" style={{ marginBottom: 56 }} aria-label="Your selections">
          <div className="eyebrow">Opened on this device</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {recent.map((r) => (
              <li key={r.token}>
                <Link className="btn btn-ghost btn-sm" to={`/a/${r.token}`}>
                  {r.title || 'Untitled selection'}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="wrap" aria-label="How it works">
        <div className="eyebrow">How it works</div>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h3>Add your works</h3>
            <p>Upload images with title, year, medium and size, in the order you'd send them.</p>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <h3>Send one link</h3>
            <p>Share the review link with a mentor. They don't need an account and can't change your works.</p>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <h3>See their picks</h3>
            <p>Get keep, maybe or cut on every piece, a note on each, and the order they'd lead with.</p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
