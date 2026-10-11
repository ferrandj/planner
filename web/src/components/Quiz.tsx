import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QUESTIONS } from '../data/quizEnA1';
import { pickQuestion, quizStats, recordAnswer, shuffled } from '../lib/quiz';
import { useApp } from '../state/app';

/** One question: asked in the language of the app and in English, answers in English. A wrong answer is fine: the right one turns green. */
export function QuizCard({ onDone, doneLabel }: { onDone: () => void; doneLabel: string }): ReactNode {
  const { data, update, realToday, lang, t, tf } = useApp();
  const [q] = useState(() => pickQuestion(data.quiz, QUESTIONS));
  const [shown] = useState(() => shuffled(q));
  const [chosen, setChosen] = useState<number | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const stats = quizStats(data.quiz);
  const answered = chosen !== null, right = answered && chosen === shown.answer;

  useEffect(() => { if (answered) next.current?.focus({ preventScroll: true }); }, [answered]);

  const pick = (i: number): void => {
    if (answered) return;
    setChosen(i);
    update((d) => { recordAnswer(d, q.id, i === shown.answer, realToday); });     // saved at once, even if the page is closed right after
  };
  const local = lang === 'en' ? null : lang === 'fr' ? q.fr : q.es;

  return (
    <div className="qz">
      <div className="qz-top">
        <span className="qz-lvl">🎓 {t('Anglais de base')} · A1</span>
        <span className="qz-prog" aria-label={tf('{a} questions réussies sur {b}', { a: stats.mastered, b: stats.total })}>
          <i style={{ width: (stats.mastered / stats.total) * 100 + '%' }} /><b>{stats.mastered}/{stats.total}</b>
        </span>
      </div>
      <h2 className="qz-q" id="qz-q">
        {local && <span className="qz-local">{local}</span>}
        <span className="qz-en" lang="en">{local && <span aria-hidden="true">🇬🇧 </span>}{q.q}</span>
      </h2>
      <div className="qz-opts" role="group" aria-labelledby="qz-q">
        {shown.options.map((o, i) => {
          const state = !answered ? '' : i === shown.answer ? ' ok' : i === chosen ? ' ko' : ' dim';
          return (
            <button key={o} type="button" lang="en" className={'qz-opt' + state} aria-pressed={chosen === i} aria-disabled={answered}
              onClick={() => pick(i)}>
              {o}{answered && i === shown.answer ? ' ✓' : ''}{answered && i === chosen && i !== shown.answer ? ' ✗' : ''}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="qz-res" role="status">
          <b className={right ? 'good' : 'bad'}>{right ? t('✅ Bravo !') : t('❌ Pas tout à fait : la bonne réponse est en vert.')}</b>
          <p>{lang === 'en' ? q.why.en : q.why[lang]}</p>
          {lang !== 'en' && <p className="qz-why-en" lang="en">{q.why.en}</p>}
        </div>
      )}
      <div className="qz-foot">
        <button ref={next} type="button" className="btn" disabled={!answered} onClick={onDone}>{doneLabel}</button>
      </div>
    </div>
  );
}

/** Shown each time the app is opened (unless the quiz is switched off). Nothing is ever locked: a wrong answer still lets you in. */
export function QuizGate(): ReactNode {
  const { data, ui, setUi, update, t } = useApp();
  if (data.prefs.quiz === false || ui.quizPassed) return null;
  return (
    <div className="ov quiz-gate" role="dialog" aria-modal="true" aria-labelledby="qz-t">
      <div className="modal wide">
        <div className="mtop acc"><div className="eyebrow" id="qz-t">{t('Une question avant d’entrer')}</div><div className="big sm">{t('Quiz d’anglais')}</div></div>
        <div className="mbody">
          <QuizCard onDone={() => setUi({ quizPassed: true })} doneLabel={t('Entrer dans le planner')} />
          <button type="button" className="lnk" onClick={() => { update((d) => { d.prefs.quiz = false; }); setUi({ quizPassed: true }); }}>{t('Désactiver ce quiz')}</button>
        </div>
      </div>
    </div>
  );
}

/** "Quiz" window: switch the quiz on or off, see the progress, practise a question. */
export function QuizDialog(): ReactNode {
  const { ui, setUi, data, update, t, tf } = useApp();
  const [practice, setPractice] = useState(0);
  const open = ui.quizOpen;
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') setUi({ quizOpen: false }); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [open, setUi]);
  if (!open) return null;
  const on = data.prefs.quiz !== false, s = quizStats(data.quiz);
  const close = (): void => { setUi({ quizOpen: false }); setPractice(0); };
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="qd-t" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal wide">
        <div className="mtop acc"><div className="eyebrow" id="qd-t">🎓 {t('Quiz d’anglais')}</div><div className="big sm">{t('Anglais de base')} · A1</div></div>
        <div className="mbody">
          <label className="check">
            <input type="checkbox" role="switch" checked={on} onChange={(e) => { update((d) => { d.prefs.quiz = e.target.checked; }); setUi({ quizPassed: true }); }} /> {t('Poser une question à chaque ouverture')}
          </label>
          <p className="hint">{tf('{a} questions réussies sur {b} · {r} bonnes réponses, {w} erreurs au total.', { a: s.mastered, b: s.total, r: s.right, w: s.wrong })}</p>
          {practice > 0 ? <QuizCard key={practice} onDone={() => setPractice(0)} doneLabel={t('Terminer')} /> : <button type="button" className="btn" onClick={() => setPractice(1)}>{t('Une question pour s’entraîner')}</button>}
          <div className="opt"><span className="spacer" /><button type="button" className="btn ghost" onClick={close}>{t('Fermer')}</button></div>
        </div>
      </div>
    </div>
  );
}
