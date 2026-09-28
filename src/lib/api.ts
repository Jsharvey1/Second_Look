import { createSupabaseApi } from './supabaseApi';
import { createLocalApi } from './localApi';
import type { Api } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const backend = import.meta.env.VITE_BACKEND as string | undefined;

export const isConfigured = backend === 'local' || Boolean(url && key);

export const api: Api =
  backend === 'local'
    ? createLocalApi()
    : createSupabaseApi(url || 'https://not-configured.invalid', key || 'missing');

export function artistLink(token: string) {
  return `${window.location.origin}/a/${token}`;
}

export function mentorLink(token: string) {
  return `${window.location.origin}/m/${token}`;
}
