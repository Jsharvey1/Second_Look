// Remembers selections this browser has opened, so an artist can find
// their way back without digging for the link. Browser-only; optional.
const KEY = 'second-look-recent';

export interface Recent {
  token: string;
  title: string;
  at: number;
}

export function getRecent(): Recent[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function rememberSelection(token: string, title: string) {
  try {
    const list = getRecent().filter((r) => r.token !== token);
    list.unshift({ token, title, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* storage unavailable — fine */
  }
}
