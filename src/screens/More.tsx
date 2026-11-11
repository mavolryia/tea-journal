import { useMemo, useRef, useState } from 'react';
import { Empty, Page, voiceSupported } from '../components/ui';
import { useData } from '../data';
import { db, validateBackup } from '../db';
import type { Backup } from '../types';
import { fmtDate, round1, store } from '../utils';

const LAST_BACKUP = 'tea-journal:lastBackup';

function Bars({ rows, max, unit = '' }: { rows: [string, number][]; max: number; unit?: string }) {
  return (
    <ul className="bars">
      {rows.map(([label, v]) => (
        <li key={label}>
          <span className="bar-label">{label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${max ? (v / max) * 100 : 0}%` }} />
          </span>
          <span className="bar-value">
            {v}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function More() {
  const { teas, sessions, teaById, refresh } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const lastBackup = store.get<string>(LAST_BACKUP);

  const stats = useMemo(() => {
    const byType = new Map<string, { sum: number; n: number }>();
    const tagCount = new Map<string, number>();
    const teaCount = new Map<string, number>();
    let grams = 0;
    for (const s of sessions) {
      grams += s.leafGrams ?? 0;
      teaCount.set(s.teaId, (teaCount.get(s.teaId) ?? 0) + 1);
      s.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1));
      const type = teaById.get(s.teaId)?.type;
      if (type && s.ratings.overall) {
        const e = byType.get(type) ?? { sum: 0, n: 0 };
        e.sum += s.ratings.overall;
        e.n++;
        byType.set(type, e);
      }
    }
    const typeRows = [...byType].map(([t, e]) => [t, round1(e.sum / e.n)] as [string, number]).sort((a, b) => b[1] - a[1]);
    const tagRows = [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const teaRows = [...teaCount]
      .map(([id, n]) => [teaById.get(id)?.name ?? 'Удалённый чай', n] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { grams: round1(grams), typeRows, tagRows, teaRows };
  }, [sessions, teaById]);

  const exportJson = async () => {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tea-journal-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    store.set(LAST_BACKUP, new Date().toISOString());
    setMsg(`Сохранено: ${data.teas.length} чаёв, ${data.sessions.length} дегустаций.`);
  };

  const onFile = async (f: File | undefined) => {
    setMsg(null);
    setPending(null);
    if (!f) return;
    try {
      const parsed: unknown = JSON.parse(await f.text());
      const err = validateBackup(parsed);
      if (err) setMsg('Не удалось загрузить: ' + err);
      else setPending(parsed as Backup);
    } catch {
      setMsg('Не удалось загрузить: файл не является корректным JSON');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const doImport = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    if (mode === 'replace' && !confirm('Все текущие данные будут заменены данными из файла. Продолжить?')) return;
    await db.importAll(pending, mode);
    await refresh();
    setMsg(`Загружено: ${pending.teas.length} чаёв, ${pending.sessions.length} дегустаций.`);
    setPending(null);
  };

  return (
    <Page title="Ещё">
      <h2>Статистика</h2>
      {sessions.length === 0 ? (
        <Empty>Статистика появится после первых дегустаций.</Empty>
      ) : (
        <>
          <div className="stat-tiles">
            <div className="tile"><b>{teas.length}</b><span>чаёв</span></div>
            <div className="tile"><b>{sessions.length}</b><span>дегустаций</span></div>
            <div className="tile"><b>{stats.grams}</b><span>г заварено</span></div>
          </div>
          {stats.typeRows.length > 0 && (
            <section className="card">
              <h3>Средняя оценка по типам</h3>
              <Bars rows={stats.typeRows} max={5} />
            </section>
          )}
          {stats.tagRows.length > 0 && (
            <section className="card">
              <h3>Частые дескрипторы</h3>
              <Bars rows={stats.tagRows} max={stats.tagRows[0][1]} />
            </section>
          )}
          <section className="card">
            <h3>Чаще всего завариваю</h3>
            <Bars rows={stats.teaRows} max={stats.teaRows[0]?.[1] ?? 0} />
          </section>
        </>
      )}

      <h2>Резервная копия</h2>
      <section className="card">
        <p>
          Данные хранятся только в этом браузере на этом устройстве. Время от времени сохраняйте копию в файл —
          например, в облако или в «Файлы».
        </p>
        <p className="muted">{lastBackup ? `Последняя копия: ${fmtDate(lastBackup)}` : 'Копия ещё ни разу не сохранялась.'}</p>
        <button className="btn wide" onClick={exportJson}>Сохранить копию (JSON)</button>
        <button className="btn ghost wide" onClick={() => fileRef.current?.click()}>Загрузить из файла…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {pending && (
          <div className="banner">
            В файле {pending.teas.length} чаёв и {pending.sessions.length} дегустаций
            {pending.exportedAt ? ` (от ${fmtDate(pending.exportedAt)})` : ''}.
            <div className="row">
              <button className="btn small" onClick={() => doImport('merge')}>Добавить к текущим</button>
              <button className="btn small danger-ghost" onClick={() => doImport('replace')}>Заменить всё</button>
            </div>
          </div>
        )}
        {msg && <p className="hint">{msg}</p>}
      </section>

      <h2>Подсказки</h2>
      <section className="card">
        <p>
          <b>Голос.</b>{' '}
          {voiceSupported
            ? 'Нажмите 🎤 рядом с полем и говорите — фразы будут добавляться в текст. Распознавание может идти через серверы браузера.'
            : 'В этом браузере встроенная диктовка недоступна — используйте микрофон на клавиатуре телефона.'}
        </p>
        <p>
          <b>Установка на телефон.</b> Android (Chrome): меню ⋮ → «Добавить на главный экран». iPhone (Safari):
          «Поделиться» → «На экран „Домой“».
        </p>
        <p>
          <b>Таймер.</b> Если у пролива указано время — идёт обратный отсчёт со звуком и вибрацией. Если нет —
          секундомер; при остановке фактическое время записывается в пролив.
        </p>
      </section>
      <p className="muted center">Tea Journal 0.1</p>
    </Page>
  );
}
