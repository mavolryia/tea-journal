import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from './db';
import type { Session, Tea } from './types';

interface DataState {
  teas: Tea[];
  sessions: Session[];
  teaById: Map<string, Tea>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [teas, setTeas] = useState<Tea[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([db.listTeas(), db.listSessions()]);
      setTeas(t);
      setSessions(s.sort((a, b) => b.date.localeCompare(a.date)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Просим браузер не удалять данные при нехватке места
    navigator.storage?.persist?.().catch(() => {});
  }, [refresh]);

  const teaById = useMemo(() => new Map(teas.map((t) => [t.id, t])), [teas]);

  return (
    <Ctx.Provider value={{ teas, sessions, teaById, loading, error, refresh }}>{children}</Ctx.Provider>
  );
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData вне DataProvider');
  return v;
}
