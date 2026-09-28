import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Api, Selection } from './types';

const BUCKET = 'works';

function friendly(error: { message?: string } | null): Error {
  const msg = error?.message ?? 'Something went wrong';
  if (/Selection not found/i.test(msg)) return new Error('This link is no longer valid.');
  if (/up to 40 works/i.test(msg)) return new Error('A selection can hold up to 40 works.');
  if (/Failed to fetch|NetworkError/i.test(msg)) return new Error('Could not reach the server. Check your connection and try again.');
  return new Error(msg);
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw friendly(error);
    return data as T;
  }

  return {
    async createSelection({ title, artistName, purpose }) {
      const data = await rpc<{ artist_token: string }>('create_selection', {
        p_title: title,
        p_artist_name: artistName,
        p_purpose: purpose,
      });
      return data.artist_token;
    },

    getArtistView: (token) => rpc<Selection | null>('get_artist_view', { p_token: token }),
    getMentorView: (token) => rpc<Selection | null>('get_mentor_view', { p_token: token }),

    async updateSelection(token, { title, artistName, purpose }) {
      await rpc('update_selection', {
        p_token: token,
        p_title: title,
        p_artist_name: artistName,
        p_purpose: purpose,
      });
    },

    async addWork(token, selectionId, image, title) {
      const path = `${selectionId}/${crypto.randomUUID()}.${image.ext}`;
      const contentType = image.ext === 'jpg' ? 'image/jpeg' : `image/${image.ext}`;
      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(path, image.blob, { contentType, upsert: false, cacheControl: '31536000' });
      if (upErr) throw friendly(upErr);
      await rpc('add_work', {
        p_token: token,
        p_image_path: path,
        p_width: image.width,
        p_height: image.height,
        p_title: title,
      });
    },

    async updateWork(token, workId, d) {
      await rpc('update_work', {
        p_token: token,
        p_work_id: workId,
        p_title: d.title,
        p_year: d.year,
        p_medium: d.medium,
        p_dimensions: d.dimensions,
      });
    },

    async deleteWork(token, workId) {
      await rpc('delete_work', { p_token: token, p_work_id: workId });
    },

    async reorderWorks(token, ids) {
      await rpc('reorder_works', { p_token: token, p_ids: ids });
    },

    async saveReview(token, { mentorName, overallNote, items, submit }) {
      return rpc<Selection>('save_review', {
        p_token: token,
        p_mentor_name: mentorName,
        p_overall_note: overallNote,
        p_items: items,
        p_submit: submit,
      });
    },

    imageUrl(path) {
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
  };
}
