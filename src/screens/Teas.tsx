import { useMemo, useState } from 'react';
import { Empty, Page, Rating } from '../components/ui';
import { useData } from '../data';
import { db } from '../db';
import { TEA_TYPES, type Session, type Tea } from '../types';
import { fmtDate, go, num, uid } from '../utils';

// ---------- Список коллекции ----------

export function TeaList() {
  const { teas, sessions } = useData();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [favOnly, setFavOnly] = useState(false);

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; last?: Session }>();
    for (const s of sessions) {
      const e = m.get(s.teaId) ?? { count: 0 };
      e.count++;
      if (!e.last || s.date > e.last.date) e.last = s;
      m.set(s.teaId, e);
    }
    return m;
  }, [sessions]);

  const typesPresent = TEA_TYPES.filter((t) => teas.some((x) => x.type === t));
  const query = q.trim().toLowerCase();
  const list = teas
    .filter((t) => !type || t.type === type)
    .filter((t) => !favOnly || t.favorite)
    .filter((t) => !query || [t.name, t.origin, t.producer, t.year, t.type].some((f) => f.toLowerCase().includes(query)))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'ru'));

  return (
    <Page
      title="Мои чаи"
      actions={
        <button className="btn small" onClick={() => go('/tea/new')}>
          + Чай
        </button>
      }
    >
      {teas.length === 0 ? (
        <Empty>
          <p className="big">🍵</p>
          <p>Коллекция пока пуста.</p>
          <button className="btn" onClick={() => go('/tea/new')}>
            Добавить первый чай
          </button>
        </Empty>
      ) : (
        <>
          <input className="search" type="search" placeholder="Поиск по названию, региону, году…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips scroll">
            <button className={'chip' + (favOnly ? ' on' : '')} onClick={() => setFavOnly(!favOnly)}>
              ★ Избранное
            </button>
            <button className={'chip' + (!type ? ' on' : '')} onClick={() => setType('')}>
              Все
            </button>
            {typesPresent.map((t) => (
              <button key={t} className={'chip' + (type === t ? ' on' : '')} onClick={() => setType(type === t ? '' : t)}>
                {t}
              </button>
            ))}
          </div>
          {list.length === 0 && <Empty>Ничего не нашлось</Empty>}
          <ul className="cards">
            {list.map((t) => {
              const st = stats.get(t.id);
              return (
                <li key={t.id} className="card clickable" onClick={() => go('/tea/' + t.id)}>
                  <div className="card-title">
                    {t.favorite && <span className="star">★</span>}
                    {t.name}
                  </div>
                  <div className="muted">{[t.type, t.year, t.origin].filter(Boolean).join(' · ')}</div>
                  <div className="card-foot">
                    <span>{st ? `${st.count} дегуст.` : 'ещё не пробовали'}</span>
                    {t.stockGrams != null && <span className={t.stockGrams <= 10 ? 'low' : ''}>осталось {t.stockGrams} г</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Page>
  );
}

// ---------- Форма чая ----------

function emptyTea(): Tea {
  const now = Date.now();
  return { id: uid(), name: '', type: TEA_TYPES[3], origin: '', producer: '', year: '', stockGrams: null, favorite: false, notes: '', createdAt: now, updatedAt: now };
}

export function TeaForm({ id }: { id?: string }) {
  const { teaById, refresh } = useData();
  const existing = id ? teaById.get(id) : undefined;
  const [t, setT] = useState<Tea | null>(() => (id ? (existing ? { ...existing } : null) : emptyTea()));
  const [saving, setSaving] = useState(false);

  if (!t) return <Page title="Не найдено" back="/"><Empty>Такого чая нет в коллекции.</Empty></Page>;

  const set = <K extends keyof Tea>(k: K, v: Tea[K]) => setT({ ...t, [k]: v });
  const nameOk = t.name.trim().length > 0;

  const save = async () => {
    if (!nameOk || saving) return;
    setSaving(true);
    const rec = { ...t, name: t.name.trim(), updatedAt: Date.now() };
    await db.putTea(rec);
    await refresh();
    go('/tea/' + rec.id, true);
  };

  return (
    <Page title={id ? 'Редактировать чай' : 'Новый чай'} back={id ? '/tea/' + id : '/'}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field">
          <span className="field-label">Название *</span>
          <input value={t.name} maxLength={120} autoFocus={!id} placeholder="Например, Лю Бао 2015" onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Тип</span>
          <select value={t.type} onChange={(e) => set('type', e.target.value)}>
            {TEA_TYPES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <div className="grid2">
          <label className="field">
            <span className="field-label">Регион</span>
            <input value={t.origin} placeholder="Уишань, Фуцзянь" onChange={(e) => set('origin', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Год</span>
            <input value={t.year} placeholder="2021" onChange={(e) => set('year', e.target.value)} />
          </label>
        </div>
        <div className="grid2">
          <label className="field">
            <span className="field-label">Производитель / магазин</span>
            <input value={t.producer} onChange={(e) => set('producer', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Остаток, г</span>
            <input type="number" inputMode="decimal" min={0} step="any" value={t.stockGrams ?? ''} onChange={(e) => set('stockGrams', num(e.target.value))} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Заметки</span>
          <textarea rows={3} value={t.notes} placeholder="Где купила, цена, как хранится…" onChange={(e) => set('notes', e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={t.favorite} onChange={(e) => set('favorite', e.target.checked)} /> В избранное
        </label>
        <button className="btn wide" type="submit" disabled={!nameOk || saving}>
          Сохранить
        </button>
        {!nameOk && <p className="hint">Укажите название, чтобы сохранить.</p>}
      </form>
    </Page>
  );
}

// ---------- Карточка чая ----------

export function TeaDetail({ id }: { id: string }) {
  const { teaById, sessions, refresh } = useData();
  const tea = teaById.get(id);
  const [picked, setPicked] = useState<string[]>([]);
  const mine = sessions.filter((s) => s.teaId === id);

  if (!tea) return <Page title="Не найдено" back="/"><Empty>Такого чая нет в коллекции.</Empty></Page>;

  const toggleFav = async () => {
    await db.putTea({ ...tea, favorite: !tea.favorite, updatedAt: Date.now() });
    refresh();
  };
  const remove = async () => {
    const msg = mine.length
      ? `Удалить «${tea.name}» и ${mine.length} дегустац. к нему? Это нельзя отменить.`
      : `Удалить «${tea.name}»?`;
    if (!confirm(msg)) return;
    await db.deleteTea(id);
    await refresh();
    go('/', true);
  };
  const pick = (sid: string) =>
    setPicked((p) => (p.includes(sid) ? p.filter((x) => x !== sid) : [...p, sid].slice(-2)));

  const rated = mine.filter((s) => s.ratings.overall > 0);
  const avg = rated.length ? rated.reduce((a, s) => a + s.ratings.overall, 0) / rated.length : 0;

  return (
    <Page
      title={tea.name}
      back="/"
      actions={
        <>
          <button className="icon-btn" onClick={toggleFav} aria-label="Избранное" title="Избранное">
            {tea.favorite ? '★' : '☆'}
          </button>
          <button className="icon-btn" onClick={() => go(`/tea/${id}/edit`)} aria-label="Редактировать" title="Редактировать">
            ✎
          </button>
        </>
      }
    >
      <section className="card">
        <dl className="props">
          <dt>Тип</dt>
          <dd>{tea.type}</dd>
          {tea.origin && (<><dt>Регион</dt><dd>{tea.origin}</dd></>)}
          {tea.year && (<><dt>Год</dt><dd>{tea.year}</dd></>)}
          {tea.producer && (<><dt>Производитель</dt><dd>{tea.producer}</dd></>)}
          <dt>Остаток</dt>
          <dd>{tea.stockGrams != null ? `${tea.stockGrams} г` : '—'}</dd>
          {avg > 0 && (<><dt>Средняя оценка</dt><dd>{avg.toFixed(1)} из 5</dd></>)}
        </dl>
        {tea.notes && <p className="prewrap">{tea.notes}</p>}
      </section>

      <button className="btn wide" onClick={() => go('/session/new?tea=' + id + (mine[0] ? '&from=' + mine[0].id : ''))}>
        + Новая дегустация
      </button>
      {mine[0] && <p className="hint">Параметры заваривания подставятся из последней дегустации.</p>}

      <h2>Дегустации ({mine.length})</h2>
      {mine.length === 0 ? (
        <Empty>Пока ни одной записи.</Empty>
      ) : (
        <>
          {mine.length > 1 && <p className="hint">Отметьте две записи, чтобы сравнить их рядом.</p>}
          <ul className="cards">
            {mine.map((s) => (
              <li key={s.id} className="card session-row">
                {mine.length > 1 && (
                  <input type="checkbox" aria-label="Выбрать для сравнения" checked={picked.includes(s.id)} onChange={() => pick(s.id)} />
                )}
                <div className="clickable grow" onClick={() => go('/session/' + s.id)}>
                  <div className="card-title">{fmtDate(s.date)}</div>
                  <div className="muted">
                    {s.method} · {s.steeps.length} пролив.
                    {s.leafGrams ? ` · ${s.leafGrams} г` : ''}
                  </div>
                  {s.ratings.overall > 0 && <Rating label="" value={s.ratings.overall} />}
                </div>
              </li>
            ))}
          </ul>
          {picked.length === 2 && (
            <button className="btn wide sticky" onClick={() => go(`/compare/${picked[0]}/${picked[1]}`)}>
              Сравнить выбранные
            </button>
          )}
        </>
      )}
      <button className="btn danger-ghost wide" onClick={remove}>
        Удалить чай
      </button>
    </Page>
  );
}
