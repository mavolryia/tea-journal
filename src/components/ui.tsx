import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ALL_DESCRIPTORS, DESCRIPTOR_GROUPS } from '../types';
import { goBack } from '../utils';

// ---------- Каркас страницы ----------

export function Page({
  title,
  back,
  actions,
  children,
}: {
  title: ReactNode;
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="topbar">
        {back !== undefined && (
          <button className="icon-btn" onClick={() => goBack(back)} aria-label="Назад">
            ←
          </button>
        )}
        <h1>{title}</h1>
        <div className="topbar-actions">{actions}</div>
      </header>
      <div className="content">{children}</div>
    </>
  );
}

// ---------- Голосовой ввод ----------

/* eslint-disable @typescript-eslint/no-explicit-any */
const SR: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

export const voiceSupported = !!SR;

/** Кнопка микрофона: распознаёт русскую речь и отдаёт готовые фразы в onText. */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [on, setOn] = useState(false);
  const rec = useRef<any>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => () => rec.current?.abort?.(), []);

  if (!SR) return null;

  const toggle = () => {
    if (on) {
      rec.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = 'ru-RU';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) cb.current(e.results[i][0].transcript.trim());
      }
    };
    r.onend = () => setOn(false);
    r.onerror = (e: any) => {
      setOn(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        alert('Нет доступа к микрофону. Разрешите его в настройках браузера или используйте диктовку на клавиатуре.');
    };
    rec.current = r;
    try {
      r.start();
      setOn(true);
    } catch {
      setOn(false);
    }
  };

  return (
    <button
      type="button"
      className={'mic' + (on ? ' on' : '')}
      onClick={toggle}
      aria-label={on ? 'Остановить запись' : 'Надиктовать'}
      title={on ? 'Остановить запись' : 'Надиктовать'}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
        />
      </svg>
    </button>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Многострочное поле с кнопкой диктовки. */
export function VoiceField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="voice-field">
        <textarea rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        <VoiceButton onText={(t) => onChange(value ? value.replace(/\s+$/, '') + ' ' + t : t)} />
      </div>
    </label>
  );
}

// ---------- Оценка листиками ----------

function Leaf() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M4 20c0-9 6.5-16 17-16 0 10.5-7 17-16 17l-1-1Zm2.5-1.5 8-8-.7-.7-8 8 .7.7Z" />
    </svg>
  );
}

export function Rating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="rating">
      <span>{label}</span>
      <div className="leaves" role={onChange ? 'radiogroup' : undefined} aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            className={n <= value ? 'on' : ''}
            disabled={!onChange}
            onClick={() => onChange?.(n === value ? 0 : n)}
            aria-label={`${label}: ${n} из 5`}
          >
            <Leaf />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Дескрипторы ----------

export function TagPicker({
  value,
  onChange,
  extra,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  extra: string[]; // свои дескрипторы из прошлых записей
}) {
  const [custom, setCustom] = useState('');
  const own = [...new Set([...extra, ...value])].filter((t) => !ALL_DESCRIPTORS.includes(t));
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const add = () => {
    const t = custom.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom('');
  };
  const groups = own.length ? [...DESCRIPTOR_GROUPS, { name: 'Мои', tags: own }] : DESCRIPTOR_GROUPS;

  return (
    <div className="tags">
      {groups.map((g) => (
        <div key={g.name} className="tag-group">
          <div className="tag-group-name">{g.name}</div>
          <div className="chips">
            {g.tags.map((t) => (
              <button type="button" key={t} className={'chip' + (value.includes(t) ? ' on' : '')} onClick={() => toggle(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="row">
        <input
          value={custom}
          placeholder="Свой дескриптор"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn ghost" onClick={add}>
          Добавить
        </button>
      </div>
    </div>
  );
}

// ---------- Таймер пролива ----------

let audioCtx: AudioContext | null = null;

function beep() {
  try {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.6);
  } catch {
    /* ignore */
  }
  navigator.vibrate?.([200, 100, 200]);
}

/**
 * Если время пролива задано — обратный отсчёт со звуком и вибрацией в конце.
 * Если не задано — секундомер. При остановке фактическое время записывается в пролив.
 */
export function SteepTimer({ planned, onStop }: { planned: number | null; onStop: (sec: number) => void }) {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const beeped = useRef(false);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (start === null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [start]);

  const elapsed = start === null ? 0 : Math.max(0, Math.floor((now - start) / 1000));
  const countdown = planned != null && planned > 0;

  useEffect(() => {
    if (start !== null && countdown && elapsed >= planned! && !beeped.current) {
      beeped.current = true;
      beep();
    }
  }, [elapsed, start, countdown, planned]);

  useEffect(() => () => void wake.current?.release().catch(() => {}), []);

  const toggle = () => {
    if (start === null) {
      beeped.current = false;
      try {
        // Звук «разблокируется» нажатием; не ждём — таймер должен стартовать сразу
        audioCtx ??= new AudioContext();
        audioCtx.resume().catch(() => {});
      } catch {
        /* без звука */
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wl = (navigator as any).wakeLock;
      wl?.request('screen').then((l: { release: () => Promise<void> }) => (wake.current = l)).catch(() => {});
      const t = Date.now();
      setStart(t);
      setNow(t);
    } else {
      const sec = Math.round((Date.now() - start) / 1000);
      setStart(null);
      wake.current?.release().catch(() => {});
      wake.current = null;
      onStop(sec);
    }
  };

  let display = '';
  if (start !== null) {
    if (countdown) {
      const left = planned! - elapsed;
      display = left >= 0 ? `${left} с` : `+${-left} с`;
    } else display = `${elapsed} с`;
  }

  return (
    <button
      type="button"
      className={'timer' + (start !== null ? ' running' : '') + (countdown && start !== null && elapsed >= planned! ? ' done' : '')}
      onClick={toggle}
    >
      {start === null ? (countdown ? `▶ ${planned} с` : '▶ Секундомер') : `■ ${display}`}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
