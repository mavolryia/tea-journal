import { Empty, Page } from './components/ui';
import { useData } from './data';
import { More } from './screens/More';
import { Compare, SessionForm, SessionList, SessionView } from './screens/Sessions';
import { TeaDetail, TeaForm, TeaList } from './screens/Teas';
import { useRoute } from './utils';

type Tab = 'teas' | 'sessions' | 'more';

export default function App() {
  const route = useRoute();
  const { loading, error } = useData();

  if (loading) return <div className="splash">Завариваем…</div>;
  if (error)
    return (
      <div className="splash">
        Не удалось открыть хранилище: {error}. Возможно, браузер в приватном режиме.
      </div>
    );

  const [a, b, c] = route.parts;
  const q = route.query;
  let tab: Tab = 'teas';
  let screen;

  if (!a || a === 'teas') screen = <TeaList />;
  else if (a === 'tea' && b === 'new') screen = <TeaForm />;
  else if (a === 'tea' && b && c === 'edit') screen = <TeaForm key={b} id={b} />;
  else if (a === 'tea' && b) screen = <TeaDetail key={b} id={b} />;
  else {
    tab = a === 'more' ? 'more' : 'sessions';
    if (a === 'sessions') screen = <SessionList />;
    else if (a === 'session' && b === 'new')
      screen = <SessionForm key={q.toString()} teaId={q.get('tea') ?? undefined} fromId={q.get('from') ?? undefined} />;
    else if (a === 'session' && b && c === 'edit') screen = <SessionForm key={b} id={b} />;
    else if (a === 'session' && b) screen = <SessionView key={b} id={b} />;
    else if (a === 'compare' && b && c) screen = <Compare a={b} b={c} />;
    else if (a === 'more') screen = <More />;
    else screen = <Page title="Не найдено" back="/"><Empty>Такой страницы нет.</Empty></Page>;
  }

  return (
    <>
      <main className="app">{screen}</main>
      <nav className="tabbar">
        <a href="#/" className={tab === 'teas' ? 'active' : ''}>
          <span aria-hidden="true">🫖</span>Мои чаи
        </a>
        <a href="#/sessions" className={tab === 'sessions' ? 'active' : ''}>
          <span aria-hidden="true">📝</span>Дегустации
        </a>
        <a href="#/more" className={tab === 'more' ? 'active' : ''}>
          <span aria-hidden="true">☰</span>Ещё
        </a>
      </nav>
    </>
  );
}
