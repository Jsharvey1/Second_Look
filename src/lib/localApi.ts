// A stand-in backend that keeps everything in this browser.
// Used only for local testing (VITE_BACKEND=local); it mirrors the
// rules in supabase/setup.sql so the screens behave the same way.
import type { Api, Selection, Work, Status, Verdict } from './types';

interface Row {
  id: string;
  title: string;
  artist_name: string;
  purpose: string;
  artist_token: string;
  mentor_token: string;
  mentor_name: string;
  overall_note: string;
  status: Status;
  created_at: string;
  reviewed_at: string | null;
  works: Work[];
}

const KEY = 'second-look-local-db';
const IMG = 'second-look-local-img:';
const token = () => crypto.randomUUID().replace(/-/g, '');
const wait = () => new Promise((r) => setTimeout(r, 120));

function load(): Row[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
function save(rows: Row[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}
function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}

function payload(r: Row, role: 'artist' | 'mentor'): Selection {
  const show = role === 'mentor' || r.status === 'reviewed';
  return {
    id: r.id,
    title: r.title,
    artist_name: r.artist_name,
    purpose: r.purpose,
    status: r.status,
    created_at: r.created_at,
    reviewed_at: r.reviewed_at,
    role,
    mentor_token: role === 'artist' ? r.mentor_token : null,
    mentor_name: show ? r.mentor_name : '',
    overall_note: show ? r.overall_note : '',
    works: [...r.works]
      .sort((a, b) => a.position - b.position)
      .map((w) => ({
        ...w,
        mentor_position: show ? w.mentor_position : null,
        verdict: show ? w.verdict : null,
        note: show ? w.note : '',
      })),
  };
}

function byArtist(rows: Row[], t: string) {
  const r = rows.find((x) => x.artist_token === t);
  if (!r) throw new Error('This link is no longer valid.');
  return r;
}

export function createLocalApi(): Api {
  return {
    async createSelection({ title, artistName, purpose }) {
      await wait();
      const rows = load();
      const r: Row = {
        id: crypto.randomUUID(),
        title: title.trim() || 'Untitled selection',
        artist_name: artistName.trim(),
        purpose: purpose.trim(),
        artist_token: token(),
        mentor_token: token(),
        mentor_name: '',
        overall_note: '',
        status: 'draft',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        works: [],
      };
      rows.push(r);
      save(rows);
      return r.artist_token;
    },
    async getArtistView(t) {
      await wait();
      const r = load().find((x) => x.artist_token === t);
      return r ? payload(r, 'artist') : null;
    },
    async getMentorView(t) {
      await wait();
      const r = load().find((x) => x.mentor_token === t);
      return r ? payload(r, 'mentor') : null;
    },
    async updateSelection(t, { title, artistName, purpose }) {
      const rows = load();
      const r = byArtist(rows, t);
      r.title = title.trim() || r.title;
      r.artist_name = artistName.trim();
      r.purpose = purpose.trim();
      save(rows);
    },
    async addWork(t, selectionId, image, title) {
      await wait();
      const rows = load();
      const r = byArtist(rows, t);
      if (r.works.length >= 40) throw new Error('A selection can hold up to 40 works.');
      const path = `${selectionId}/${crypto.randomUUID()}.${image.ext}`;
      localStorage.setItem(IMG + path, await blobToDataUrl(image.blob));
      r.works.push({
        id: crypto.randomUUID(),
        image_path: path,
        width: image.width,
        height: image.height,
        title: title.trim(),
        year: '',
        medium: '',
        dimensions: '',
        position: r.works.reduce((m, w) => Math.max(m, w.position + 1), 0),
        mentor_position: null,
        verdict: null,
        note: '',
      });
      save(rows);
    },
    async updateWork(t, id, d) {
      const rows = load();
      const w = byArtist(rows, t).works.find((x) => x.id === id);
      if (w) Object.assign(w, d);
      save(rows);
    },
    async deleteWork(t, id) {
      const rows = load();
      const r = byArtist(rows, t);
      r.works = r.works.filter((w) => w.id !== id);
      save(rows);
    },
    async reorderWorks(t, ids) {
      const rows = load();
      const r = byArtist(rows, t);
      ids.forEach((id, i) => {
        const w = r.works.find((x) => x.id === id);
        if (w) w.position = i;
      });
      save(rows);
    },
    async saveReview(t, { mentorName, overallNote, items, submit }) {
      await wait();
      const rows = load();
      const r = rows.find((x) => x.mentor_token === t);
      if (!r) throw new Error('This link is no longer valid.');
      for (const it of items) {
        const w = r.works.find((x) => x.id === it.id);
        if (!w) continue;
        w.verdict = (['keep', 'maybe', 'cut'] as Verdict[]).includes(it.verdict as Verdict) ? it.verdict : null;
        w.note = it.note;
        w.mentor_position = it.position;
      }
      r.mentor_name = mentorName.trim();
      r.overall_note = overallNote;
      r.status = submit ? 'reviewed' : r.status === 'reviewed' ? 'reviewed' : 'in_review';
      if (submit) r.reviewed_at = new Date().toISOString();
      save(rows);
      return payload(r, 'mentor');
    },
    imageUrl(path) {
      return localStorage.getItem(IMG + path) || '';
    },
  };
}
