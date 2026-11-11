import { useEffect, useMemo, useState } from 'react';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/** Строка из поля ввода → число или null (запятая тоже понимается). */
export function num(v: string): number | null {
  const t = v.replace(',', '.').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function fmtDate(s: string, withTime = true): string {
  const d = new Date(s);
  if (isNaN(+d)) return s;
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function fmtSec(sec: number | null): string {
  if (sec == null) return '—';
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} мин ${s} с` : `${m} мин`;
}

// ---------- Простой роутер на #hash ----------

export interface Route {
  parts: string[];
  query: URLSearchParams;
}

let navCount = 0;

export function parseHash(h: string): Route {
  const raw = h.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  return { parts: p.split('/').filter(Boolean), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => {
      navCount++;
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return useMemo(() => parseHash(hash), [hash]);
}

export function go(path: string, replace = false) {
  const h = '#' + path;
  if (replace) location.replace(h);
  else location.hash = h;
}

/** «Назад»: по истории, если мы уже ходили внутри приложения, иначе на родительский экран. */
export function goBack(fallback: string) {
  if (navCount > 0) history.back();
  else go(fallback, true);
}

// ---------- localStorage без падений ----------

export const store = {
  get<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* приватный режим или нет места — не критично */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
