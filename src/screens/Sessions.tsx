import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Empty, Page, Rating, SteepTimer, TagPicker, VoiceField } from '../components/ui';
import { useData } from '../data';
import { db } from '../db';
import { ALL_DESCRIPTORS, DEFAULT_TEMP, METHODS, type Ratings, type Session, type Steep } from '../types';
import { fmtDate, fmtSec, go, nowLocal, num, round1, store, uid } from '../utils';

const DRAFT_KEY = 'tea-journal:draft';
const newSteep = (tempC: number | null): Steep => ({ id: uid(), tempC, seconds: null, notes: '' });

function emptySession(teaId: string, teaType?: string): Session {
  const now = Date.now();
  return {
    id: uid(), teaId, date: nowLocal(), method: METHODS[0], vessel: '',
    leafGrams: null, waterMl: null, water: '',
    dryAroma: '', warmAroma: '', taste: '', texture: '', aftertaste: '',
    tags: [], steeps: [newSteep(teaType ? DEFAULT_TEMP[teaType] ?? 95 : 95)],
    ratings: { aroma: 0, taste: 0, aftertaste: 0, overall: 0 },
    comment: '', createdAt: now, updatedAt: now,
  };
}

function ratio(s: Pick<Session, 'leafGrams' | 'waterMl'>): string | null {
  if (!s.leafGrams || !s.waterMl) return null;
  return `1:${Math.round(s.waterMl / s.leafGrams)} · ${round1((s.leafGrams / s.waterMl) * 100)} г на 100 мл`;
}

// ---------- Список всех дегустаций ----------

export function SessionList() {
  const { sessions, teaById, teas } = useData();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = sessions.filter((s) => {
    if (!query) return true;
    const tea = teaById.get(s.teaId);
    return [tea?.name ?? '', s.method, s.comment, s.taste, s.tags.join(' ')].some((f) => f.toLowerCase().includes(query));
  });

  return (
    <Page
      title="Дегустации"
      actions={
        teas.length > 0 && (
          <button className="btn small" onClick={() => go('/session/new')}>
            + Запись
          </button>
        )
      }
    >
      {sessions.length === 0 ? (
        <Empty>
          <p className="big">📝</p>
          <p>Записей пока нет.</p>
          {teas.length ? (
            <button className="btn" onClick={() => go('/session/new')}>Новая дегустация</button>
          ) : (
            <button className="btn" onClick={() => go('/tea/new')}>Сначала добавьте чай</button>
          )}
        </Empty>
      ) : (
        <>
          <input className="search" type="search" placeholder="Поиск по чаю, дескрипторам, заметкам…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="cards">
            {list.map((s) => (
              <li key={s.id} className="card clickable" onClick={() => go('/session/' + s.id)}>
                <div className="card-title">{teaById.get(s.teaId)?.name ?? 'Удалённый чай'}</div>
                <div className="muted">
                  {fmtDate(s.date)} · {s.steeps.length} пролив.
                </div>
                {s.tags.length > 0 && <div className="tag-line">{s.tags.slice(0, 6).join(', ')}</div>}
                {s.ratings.overall > 0 && <Rating label="" value={s.ratings.overall} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

// ---------- Форма дегустации ----------

interface Draft {
  session: Session;
  savedAt: number;
}

export function SessionForm({ id, teaId, fromId }: { id?: string; teaId?: string; fromId?: string }) {
  const { teas, sessions, teaById, refresh } = useData();
  const [restored, setRestored] = useState(false);

  const [s, setS] = useState<Session | null>(() => {
    if (id) {
      const ex = sessions.find((x) => x.id === id);
      return ex ? structuredClone(ex) : null;
    }
    // Новая запись: сначала пробуем восстановить незавершённый черновик (за последние сутки)
    const draft = store.get<Draft>(DRAFT_KEY);
    if (draft && Date.now() - draft.savedAt < 24 * 3600 * 1000 && teaById.has(draft.session.teaId)) {
      setTimeout(() => setRestored(true));
      return draft.session;
    }
    return fresh();
  });

  function fresh(): Session {
    const from = fromId ? sessions.find((x) => x.id === fromId) : undefined;
    const tId = teaId ?? from?.teaId ?? teas[0]?.id ?? '';
    const base = emptySession(tId, teaById.get(tId)?.type);
    if (from) {
      Object.assign(base, {
        method: from.method, vessel: from.vessel, leafGrams: from.leafGrams, waterMl: from.waterMl, water: from.water,
        steeps: from.steeps.map((st) => ({ ...st, id: uid(), notes: '' })),
      });
    }
    return base;
  }

  const [deduct, setDeduct] = useState(!id);
  const [saving, setSaving] = useState(false);
  const initial = useRef(JSON.stringify(s));

  // Автосохранение черновика новой записи — чтобы не потерять заметки, если вкладка перезагрузится.
  // Пустую, нетронутую форму черновиком не считаем.
  useEffect(() => {
    if (!id && s && JSON.stringify(s) !== initial.current)
      store.set(DRAFT_KEY, { session: s, savedAt: Date.now() } satisfies Draft);
  }, [id, s]);

  const ownTags = useMemo(
    () => [...new Set(sessions.flatMap((x) => x.tags))].filter((t) => !ALL_DESCRIPTORS.includes(t)),
    [sessions],
  );

  if (!teas.length)
    return (
      <Page title="Новая дегустация" back="/sessions">
        <Empty>
          <p>Сначала добавьте чай в коллекцию.</p>
          <button className="btn" onClick={() => go('/tea/new')}>Добавить чай</button>
        </Empty>
      </Page>
    );
  if (!s) return <Page title="Не найдено" back="/sessions"><Empty>Запись не найдена.</Empty></Page>;

  const set = <K extends keyof Session>(k: K, v: Session[K]) => setS((p) => (p ? { ...p, [k]: v } : p));
  const setRating = (k: keyof Ratings, v: number) => setS((p) => (p ? { ...p, ratings: { ...p.ratings, [k]: v } } : p));
  const updSteep = (i: number, patch: Partial<Steep>) =>
    setS((p) => (p ? { ...p, steeps: p.steeps.map((st, j) => (j === i ? { ...st, ...patch } : st)) } : p));
  const addSteep = () =>
    setS((p) => (p ? { ...p, steeps: [...p.steeps, newSteep(p.steeps[p.steeps.length - 1]?.tempC ?? null)] } : p));
  const removeSteep = (i: number) => {
    if (s.steeps[i].notes && !confirm(`Удалить пролив ${i + 1} с заметками?`)) return;
    setS((p) => (p ? { ...p, steeps: p.steeps.filter((_, j) => j !== i) } : p));
  };

  const tea = teaById.get(s.teaId);
  const r = ratio(s);

  const save = async () => {
    if (!tea || saving) return;
    setSaving(true);
    const rec: Session = { ...s, updatedAt: Date.now() };
    await db.putSession(rec);
    if (!id && deduct && s.leafGrams && tea.stockGrams != null) {
      await db.putTea({ ...tea, stockGrams: Math.max(0, round1(tea.stockGrams - s.leafGrams)), updatedAt: Date.now() });
    }
    if (!id) store.remove(DRAFT_KEY);
    await refresh();
    go('/session/' + rec.id, true);
  };

  const discardDraft = () => {
    store.remove(DRAFT_KEY);
    setRestored(false);
    const f = fresh();
    initial.current = JSON.stringify(f);
    setS(f);
  };

  return (
    <Page title={id ? 'Редактировать запись' : 'Новая дегустация'} back={id ? '/session/' + id : '/sessions'}>
      {restored && (
        <div className="banner">
          Восстановлен незаконченный черновик.
          <button className="link" onClick={discardDraft}>Начать заново</button>
        </div>
      )}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <section className="card">
          <label className="field">
            <span className="field-label">Чай</span>
            <select value={s.teaId} onChange={(e) => set('teaId', e.target.value)}>
              {teas
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
          </label>
          <div className="grid2">
            <label className="field">
              <span className="field-label">Когда</span>
              <input type="datetime-local" value={s.date} onChange={(e) => set('date', e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Способ</span>
              <select value={s.method} onChange={(e) => set('method', e.target.value)}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>
          <div className="grid3">
            <label className="field">
              <span className="field-label">Лист, г</span>
              <input type="number" inputMode="decimal" min={0} step="any" value={s.leafGrams ?? ''} onChange={(e) => set('leafGrams', num(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-label">Объём, мл</span>
              <input type="number" inputMode="numeric" min={0} value={s.waterMl ?? ''} onChange={(e) => set('waterMl', num(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-label">Посуда</span>
              <input value={s.vessel} placeholder="гайвань" onChange={(e) => set('vessel', e.target.value)} />
            </label>
          </div>
          {r && <p className="hint">Соотношение {r}</p>}
          <label className="field">
            <span className="field-label">Вода</span>
            <input value={s.water} placeholder="фильтр, бутилированная…" onChange={(e) => set('water', e.target.value)} />
          </label>
          {!id && tea?.stockGrams != null && s.leafGrams ? (
            <label className="check">
              <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />
              Списать {s.leafGrams} г из остатка ({tea.stockGrams} г)
            </label>
          ) : null}
        </section>

        <section className="card">
          <h2>Аромат листа</h2>
          <VoiceField label="Сухой лист" value={s.dryAroma} onChange={(v) => set('dryAroma', v)} rows={2} />
          <VoiceField label="Прогретый / влажный лист" value={s.warmAroma} onChange={(v) => set('warmAroma', v)} rows={2} />
        </section>

        <section className="card">
          <h2>Проливы</h2>
          {s.steeps.map((st, i) => (
            <div className="steep" key={st.id}>
              <div className="steep-head">
                <strong>Пролив {i + 1}</strong>
                <button type="button" className="link danger" onClick={() => removeSteep(i)}>удалить</button>
              </div>
              <div className="steep-params">
                <label className="mini">
                  t, °C
                  <input type="number" inputMode="numeric" value={st.tempC ?? ''} onChange={(e) => updSteep(i, { tempC: num(e.target.value) })} />
                </label>
                <label className="mini">
                  время, с
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={st.seconds ?? ''}
                    placeholder={i > 0 && s.steeps[i - 1].seconds ? String(s.steeps[i - 1].seconds! + 5) : ''}
                    onChange={(e) => updSteep(i, { seconds: num(e.target.value) })}
                  />
                </label>
                <SteepTimer planned={st.seconds} onStop={(sec) => updSteep(i, { seconds: sec })} />
              </div>
              <VoiceField value={st.notes} onChange={(v) => updSteep(i, { notes: v })} placeholder="Что изменилось в этом проливе?" rows={2} />
            </div>
          ))}
          <button type="button" className="btn ghost wide" onClick={addSteep}>+ Пролив</button>
        </section>

        <section className="card">
          <h2>Впечатления</h2>
          <VoiceField label="Вкус" value={s.taste} onChange={(v) => set('taste', v)} />
          <VoiceField label="Текстура / тело" value={s.texture} onChange={(v) => set('texture', v)} rows={2} />
          <VoiceField label="Послевкусие" value={s.aftertaste} onChange={(v) => set('aftertaste', v)} rows={2} />
        </section>

        <section className="card">
          <h2>Дескрипторы</h2>
          <TagPicker value={s.tags} onChange={(v) => set('tags', v)} extra={ownTags} />
        </section>

        <section className="card">
          <h2>Оценка</h2>
          <Rating label="Аромат" value={s.ratings.aroma} onChange={(v) => setRating('aroma', v)} />
          <Rating label="Вкус" value={s.ratings.taste} onChange={(v) => setRating('taste', v)} />
          <Rating label="Послевкусие" value={s.ratings.aftertaste} onChange={(v) => setRating('aftertaste', v)} />
          <Rating label="Общая" value={s.ratings.overall} onChange={(v) => setRating('overall', v)} />
        </section>

        <section className="card">
          <VoiceField label="Свободный комментарий" value={s.comment} onChange={(v) => set('comment', v)} rows={4} placeholder="Всё, что не влезло в категории" />
        </section>

        <button className="btn wide sticky" type="submit" disabled={saving}>Сохранить запись</button>
      </form>
    </Page>
  );
}

// ---------- Просмотр дегустации ----------

function Block({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="block">
      <div className="field-label">{title}</div>
      <p className="prewrap">{text}</p>
    </div>
  );
}

export function SessionView({ id }: { id: string }) {
  const { sessions, teaById, refresh } = useData();
  const s = sessions.find((x) => x.id === id);
  if (!s) return <Page title="Не найдено" back="/sessions"><Empty>Запись не найдена.</Empty></Page>;
  const tea = teaById.get(s.teaId);
  const r = ratio(s);

  const remove = async () => {
    if (!confirm('Удалить эту дегустацию? Это нельзя отменить.')) return;
    await db.deleteSession(id);
    await refresh();
    go(tea ? '/tea/' + tea.id : '/sessions', true);
  };

  const hasRatings = Object.values(s.ratings).some((v) => v > 0);

  return (
    <Page
      title={tea?.name ?? 'Дегустация'}
      back={tea ? '/tea/' + tea.id : '/sessions'}
      actions={
        <button className="icon-btn" onClick={() => go(`/session/${id}/edit`)} aria-label="Редактировать" title="Редактировать">✎</button>
      }
    >
      <section className="card">
        <div className="card-title">{fmtDate(s.date)}</div>
        <div className="muted">
          {[s.method, s.vessel, s.leafGrams && `${s.leafGrams} г`, s.waterMl && `${s.waterMl} мл`, s.water].filter(Boolean).join(' · ')}
        </div>
        {r && <div className="muted">Соотношение {r}</div>}
      </section>

      {(s.dryAroma || s.warmAroma) && (
        <section className="card">
          <Block title="Сухой лист" text={s.dryAroma} />
          <Block title="Прогретый лист" text={s.warmAroma} />
        </section>
      )}

      {s.steeps.length > 0 && (
        <section className="card">
          <h2>Проливы</h2>
          <ol className="steep-list">
            {s.steeps.map((st, i) => (
              <li key={st.id}>
                <span className="steep-meta">
                  {i + 1}. {st.tempC != null ? `${st.tempC}°` : '—'} · {fmtSec(st.seconds)}
                </span>
                {st.notes && <span className="prewrap"> — {st.notes}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {(s.taste || s.texture || s.aftertaste) && (
        <section className="card">
          <Block title="Вкус" text={s.taste} />
          <Block title="Текстура" text={s.texture} />
          <Block title="Послевкусие" text={s.aftertaste} />
        </section>
      )}

      {s.tags.length > 0 && (
        <section className="card">
          <div className="chips">{s.tags.map((t) => <span key={t} className="chip on static">{t}</span>)}</div>
        </section>
      )}

      {hasRatings && (
        <section className="card">
          <Rating label="Аромат" value={s.ratings.aroma} />
          <Rating label="Вкус" value={s.ratings.taste} />
          <Rating label="Послевкусие" value={s.ratings.aftertaste} />
          <Rating label="Общая" value={s.ratings.overall} />
        </section>
      )}

      {s.comment && (
        <section className="card">
          <Block title="Комментарий" text={s.comment} />
        </section>
      )}

      <button className="btn wide" onClick={() => go(`/session/new?tea=${s.teaId}&from=${s.id}`)}>
        Заварить так же ещё раз
      </button>
      <button className="btn danger-ghost wide" onClick={remove}>Удалить запись</button>
    </Page>
  );
}

// ---------- Сравнение двух дегустаций ----------

export function Compare({ a, b }: { a: string; b: string }) {
  const { sessions, teaById } = useData();
  const pair = [sessions.find((x) => x.id === a), sessions.find((x) => x.id === b)];
  if (!pair[0] || !pair[1]) return <Page title="Сравнение" back="/sessions"><Empty>Одна из записей не найдена.</Empty></Page>;
  const [x, y] = (pair as Session[]).sort((p, q) => p.date.localeCompare(q.date)); // старая слева
  const common = new Set(x.tags.filter((t) => y.tags.includes(t)));
  const steeps = Math.max(x.steeps.length, y.steeps.length);
  const sameTea = x.teaId === y.teaId;
  const sameDay = x.date.slice(0, 10) === y.date.slice(0, 10);

  const row = (label: string, f: (s: Session) => ReactNode) => (
    <tr key={label}>
      <th>{label}</th>
      <td>{f(x)}</td>
      <td>{f(y)}</td>
    </tr>
  );
  const stars = (n: number) => (n ? '●'.repeat(n) + '○'.repeat(5 - n) : '—');

  return (
    <Page title="Сравнение" back={sameTea ? '/tea/' + x.teaId : '/sessions'}>
      <div className="table-wrap">
        <table className="compare">
          <thead>
            <tr>
              <th></th>
              <th>{fmtDate(x.date, sameDay)}</th>
              <th>{fmtDate(y.date, sameDay)}</th>
            </tr>
          </thead>
          <tbody>
            {!sameTea && row('Чай', (s) => teaById.get(s.teaId)?.name ?? '—')}
            {row('Способ', (s) => s.method)}
            {row('Лист / вода', (s) => `${s.leafGrams ?? '—'} г / ${s.waterMl ?? '—'} мл`)}
            {row('Вода', (s) => s.water || '—')}
            {row('Сухой лист', (s) => s.dryAroma || '—')}
            {row('Прогретый лист', (s) => s.warmAroma || '—')}
            {Array.from({ length: steeps }, (_, i) =>
              row(`Пролив ${i + 1}`, (s) => {
                const st = s.steeps[i];
                if (!st) return '—';
                return (
                  <>
                    <span className="steep-meta">{st.tempC ?? '—'}° · {fmtSec(st.seconds)}</span>
                    {st.notes && <div>{st.notes}</div>}
                  </>
                );
              }),
            )}
            {row('Вкус', (s) => s.taste || '—')}
            {row('Текстура', (s) => s.texture || '—')}
            {row('Послевкусие', (s) => s.aftertaste || '—')}
            {row('Дескрипторы', (s) =>
              s.tags.length ? s.tags.map((t) => <span key={t} className={'chip static' + (common.has(t) ? ' on' : '')}>{t}</span>) : '—',
            )}
            {row('Аромат', (s) => stars(s.ratings.aroma))}
            {row('Вкус (оц.)', (s) => stars(s.ratings.taste))}
            {row('Послевкусие (оц.)', (s) => stars(s.ratings.aftertaste))}
            {row('Общая', (s) => stars(s.ratings.overall))}
            {row('Комментарий', (s) => s.comment || '—')}
          </tbody>
        </table>
      </div>
      {common.size > 0 && <p className="hint">Выделены дескрипторы, совпавшие в обеих записях.</p>}
    </Page>
  );
}
