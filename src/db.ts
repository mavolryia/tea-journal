// Тонкая обёртка над IndexedDB. Всё хранится прямо в браузере на устройстве.
import type { Backup, Session, Tea } from './types';

const DB_NAME = 'tea-journal';
const DB_VERSION = 1;
type StoreName = 'teas' | 'sessions';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('teas')) {
          db.createObjectStore('teas', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id' });
          s.createIndex('teaId', 'teaId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

/** Выполняет действия в одной транзакции и ждёт её завершения. */
async function run<T>(
  stores: StoreName[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    const req = fn(tx);
    if (req) req.onsuccess = () => (result = req.result);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  listTeas: () => run<Tea[]>(['teas'], 'readonly', (tx) => tx.objectStore('teas').getAll()),
  putTea: (tea: Tea) => run(['teas'], 'readwrite', (tx) => void tx.objectStore('teas').put(tea)),

  /** Удаляет чай вместе со всеми его дегустациями. */
  deleteTea: (id: string) =>
    run(['teas', 'sessions'], 'readwrite', (tx) => {
      tx.objectStore('teas').delete(id);
      const cur = tx.objectStore('sessions').index('teaId').openCursor(IDBKeyRange.only(id));
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) {
          c.delete();
          c.continue();
        }
      };
    }),

  listSessions: () =>
    run<Session[]>(['sessions'], 'readonly', (tx) => tx.objectStore('sessions').getAll()),
  putSession: (s: Session) =>
    run(['sessions'], 'readwrite', (tx) => void tx.objectStore('sessions').put(s)),
  deleteSession: (id: string) =>
    run(['sessions'], 'readwrite', (tx) => void tx.objectStore('sessions').delete(id)),

  async exportAll(): Promise<Backup> {
    const [teas, sessions] = await Promise.all([db.listTeas(), db.listSessions()]);
    return { app: 'tea-journal', version: 1, exportedAt: new Date().toISOString(), teas, sessions };
  },

  /** replace — стереть всё и загрузить копию; merge — добавить/обновить записи по id. */
  importAll: (data: Backup, mode: 'replace' | 'merge') =>
    run(['teas', 'sessions'], 'readwrite', (tx) => {
      const teas = tx.objectStore('teas');
      const sessions = tx.objectStore('sessions');
      if (mode === 'replace') {
        teas.clear();
        sessions.clear();
      }
      data.teas.forEach((t) => teas.put(t));
      data.sessions.forEach((s) => sessions.put(s));
    }),
};

/** Проверка, что JSON похож на резервную копию Tea Journal. Возвращает текст ошибки или null. */
export function validateBackup(x: unknown): string | null {
  if (!x || typeof x !== 'object') return 'Файл не содержит JSON-объект';
  const b = x as Partial<Backup>;
  if (b.app !== 'tea-journal') return 'Это не резервная копия Tea Journal';
  if (!Array.isArray(b.teas) || !Array.isArray(b.sessions)) return 'В файле нет списков чаёв и дегустаций';
  const badTea = b.teas.find((t) => !t || typeof t.id !== 'string' || typeof t.name !== 'string');
  if (badTea) return 'В файле есть повреждённая запись чая';
  const badSession = b.sessions.find(
    (s) => !s || typeof s.id !== 'string' || typeof s.teaId !== 'string' || !Array.isArray(s.steeps),
  );
  if (badSession) return 'В файле есть повреждённая запись дегустации';
  return null;
}
