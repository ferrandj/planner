import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LEVELS, QUESTIONS, type Level } from '../data/quizBank';
import { levelStats, pickRound, quizStats, recordAnswer, ROUND, shuffled } from '../lib/quiz';
import { stopVoice, voice } from '../lib/voice';
import { useApp } from '../state/app';

/**
 * A round of questions: asked in the language of the app and in English, answers in English. A wrong answer is fine: the right one
 * turns green. The voice reads the question when asked to (🔊) and the right answer after each answer.
 */
export function QuizCard(props: { onDone: () => void; doneLabel: string }): ReactNode {
  const { data } = useApp();
  return <QuizRound key={data.prefs.quizLevel ?? 'auto'} {...props} />;          // choosing another level starts a new round
}

/** Which level the questions come from: "auto" goes through A1, A2 and B1 in turn; or one level of your choice. */
export function LevelPicker(): ReactNode {
  const { data, update, t, tf } = useApp();
  const level = data.prefs.quizLevel ?? 'auto';
  const stats = levelStats(data.quiz);
  const options: Array<['auto' | Level, string, string]> = [
    ['auto', t('Auto'), t('Je progresse niveau par niveau : A1, puis A2, puis B1.')],
    ...stats.map((x): ['auto' | Level, string, string] => [x.id, x.name + (x.done ? ' ✓' : ''), tf('Niveau {l} : {a} réussies sur {b}', { l: x.name, a: x.mastered, b: x.total })])
  ];
  return (
    <div className="qz-pick" role="group" aria-label={t('Niveau des questions')}>
      <span className="qz-pick-l">{t('Niveau')}</span>
      {options.map(([id, label, title]) => (
        <button key={id} type="button" className="fchip" aria-pressed={level === id} title={title} aria-label={title}
          onClick={() => { if (level !== id) update((d) => { d.prefs.quizLevel = id; }); }}>{label}</button>
      ))}
    </div>
  );
}

function QuizRound({ onDone, doneLabel }: { onDone: () => void; doneLabel: string }): ReactNode {
  const { data, update, realToday, lang, t, tf } = useApp();
  const [before] = useState(() => levelStats(data.quiz));              // progress when the round started
  const [round] = useState(() => pickRound(data.quiz, ROUND, QUESTIONS, Math.random, data.prefs.quizLevel ?? 'auto').map((q) => ({ q, shown: shuffled(q) })));
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<Array<number | null>>(() => round.map(() => null));
  const next = useRef<HTMLButtonElement>(null);
  const voiceOn = data.prefs.quizVoice !== false;
  const [blocked, setBlocked] = useState(false);                     // the browser refused to start the voice by itself
  const finished = i >= round.length;
  const cur = round[Math.min(i, round.length - 1)];
  const pickedHere = chosen[Math.min(i, round.length - 1)];
  const answered = pickedHere !== null, right = answered && pickedHere === cur.shown.answer;
  const lvl = LEVELS.find((l) => l.id === cur.q.level)!;
  const lstat = levelStats(data.quiz).find((x) => x.id === cur.q.level)!;

  useEffect(() => () => stopVoice(), []);
  // the voice reads each question by itself (unless switched off); the browser may refuse until the page has been clicked once
  useEffect(() => {
    if (!voiceOn || finished || chosen[i] !== null) return;
    let live = true;
    void voice.play(round[i].q.qa).then((r) => { if (live) setBlocked(r === 'blocked'); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, voiceOn]);
  useEffect(() => { if (answered) next.current?.focus({ preventScroll: true }); }, [answered, i]);

  const pick = (k: number): void => {
    if (answered || finished) return;
    setChosen((c) => c.map((v, j) => (j === i ? k : v)));
    update((d) => { recordAnswer(d, cur.q.id, k === cur.shown.answer, realToday); });     // saved at once, even if the page is closed right after
    if (voiceOn) void voice.play(cur.q.aa).then((r) => setBlocked(r === 'blocked'));
  };
  const local = lang === 'en' ? null : lang === 'fr' ? cur.q.fr : cur.q.es;

  if (finished) {
    const score = chosen.filter((c, j) => c === round[j].shown.answer).length;
    const after = levelStats(data.quiz);
    const finishedNow = after.filter((x, j) => x.done && !before[j].done);
    const nextLevel = after.find((x) => !x.done);
    return (
      <div className="qz">
        <div className="qz-top"><span className="qz-lvl">🎓 {t('Anglais')} · {t('Résultat')}</span></div>
        <h2 className="qz-score" id="qz-q" role="status">{tf('{a} bonnes réponses sur {b}', { a: score, b: round.length })}</h2>
        <p className="qz-dots" aria-hidden="true">{round.map((r, j) => <span key={r.q.id}>{chosen[j] === r.shown.answer ? '✅' : '❌'}</span>)}</p>
        <ul className="qz-recap">
          {round.map((r, j) => (
            <li key={r.q.id} className={chosen[j] === r.shown.answer ? 'ok' : 'ko'}>
              <span lang="en">{r.q.aa}</span>
              <button type="button" className="qz-say" aria-label={t('Écouter la bonne réponse') + ' : ' + r.q.aa} onClick={() => void voice.play(r.q.aa)}>🔊</button>
            </li>
          ))}
        </ul>
        {finishedNow.map((x) => (
          <p key={x.id} className="qz-up" role="status">🎉 {nextLevel ? tf('Niveau {l} terminé ! Tu passes au niveau {n}.', { l: x.name, n: nextLevel.name }) : tf('Niveau {l} terminé ! Tu as fini tous les niveaux : on révise.', { l: x.name })}</p>
        ))}
        <div className="qz-levels">
          {after.map((x) => (
            <span key={x.id} className={'qz-lv' + (x.done ? ' done' : '')}>{x.name} <b>{x.mastered}/{x.total}</b></span>
          ))}
        </div>
        <div className="qz-foot">
          <button ref={next} type="button" className="btn" onClick={onDone}>{doneLabel}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="qz">
      <div className="qz-top">
        <span className="qz-lvl">🎓 {t('Anglais')} · {lvl.name}</span>
        <span className="qz-count" aria-label={tf('Question {a} sur {b}', { a: i + 1, b: round.length })}>{i + 1} / {round.length}</span>
        <span className="qz-prog" aria-label={tf('{a} questions réussies sur {b}', { a: lstat.mastered, b: lstat.total })}>
          <i style={{ width: (lstat.mastered / lstat.total) * 100 + '%' }} /><b>{lstat.mastered}/{lstat.total}</b>
        </span>
        <button type="button" className="fchip" aria-pressed={voiceOn} title={t('Voix')} onClick={() => { if (voiceOn) stopVoice(); update((d) => { d.prefs.quizVoice = !voiceOn; }); }}>{voiceOn ? '🔊' : '🔇'} {t('Voix')}</button>
      </div>
      <LevelPicker />
      <h2 className="qz-q" id="qz-q">
        {local && <span className="qz-local">{local}</span>}
        <span className="qz-en" lang="en">{local && <span aria-hidden="true">🇬🇧 </span>}{cur.q.q}</span>
      </h2>
      <p className="qz-listen">
        <button type="button" className={'fchip' + (blocked ? ' pulse' : '')} onClick={() => { void voice.play(cur.q.qa).then((r) => setBlocked(r === 'blocked')); }}>🔊 {t('Écouter la question')}</button>
        {blocked && <span className="qz-hint" role="status"> {t('Ton navigateur attend un clic avant de lancer la voix : appuie sur « Écouter la question ». Ensuite elle se lancera toute seule.')}</span>}
      </p>
      <div className="qz-opts" role="group" aria-labelledby="qz-q">
        {cur.shown.options.map((o, k) => {
          const state = !answered ? '' : k === cur.shown.answer ? ' ok' : k === pickedHere ? ' ko' : ' dim';
          return (
            <button key={o} type="button" lang="en" className={'qz-opt' + state} aria-pressed={pickedHere === k} aria-disabled={answered}
              onClick={() => pick(k)}>
              {o}{answered && k === cur.shown.answer ? ' ✓' : ''}{answered && k === pickedHere && k !== cur.shown.answer ? ' ✗' : ''}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="qz-res" role="status">
          <b className={right ? 'good' : 'bad'}>{right ? t('✅ Bravo !') : t('❌ Pas tout à fait : la bonne réponse est en vert.')}</b>
          <p>{lang === 'en' ? cur.q.why.en : cur.q.why[lang]}</p>
          {lang !== 'en' && <p className="qz-why-en" lang="en">{cur.q.why.en}</p>}
          <button type="button" className="fchip" onClick={() => void voice.play(cur.q.aa)}>🔊 {t('Écouter la bonne réponse')}</button>
        </div>
      )}
      <div className="qz-foot">
        <button ref={next} type="button" className="btn" disabled={!answered} onClick={() => { stopVoice(); setI(i + 1); }}>{i + 1 < round.length ? t('Question suivante') : t('Voir le résultat')}</button>
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
          <div className="qz-skip">
            <button type="button" className="btn ghost" onClick={() => setUi({ quizPassed: true })}>{t('Passer et accéder au site')}</button>
            <button type="button" className="lnk" onClick={() => { update((d) => { d.prefs.quiz = false; }); setUi({ quizPassed: true }); }}>{t('Désactiver ce quiz')}</button>
          </div>
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
  const on = data.prefs.quiz !== false, s = quizStats(data.quiz), lv = levelStats(data.quiz);
  const voiceOn = data.prefs.quizVoice !== false;
  const close = (): void => { setUi({ quizOpen: false }); setPractice(0); };
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="qd-t" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal wide">
        <div className="mtop acc"><div className="eyebrow" id="qd-t">🎓 {t('Quiz d’anglais')}</div><div className="big sm">{t('Anglais')} · A1 → B1</div></div>
        <div className="mbody">
          <label className="check">
            <input type="checkbox" role="switch" checked={on} onChange={(e) => { update((d) => { d.prefs.quiz = e.target.checked; }); setUi({ quizPassed: true }); }} /> {t('Poser une question à chaque ouverture')}
          </label>
          <label className="check">
            <input type="checkbox" role="switch" checked={voiceOn} onChange={(e) => { if (!e.target.checked) stopVoice(); update((d) => { d.prefs.quizVoice = e.target.checked; }); }} /> {t('Voix : lire la bonne réponse à voix haute')}
          </label>
          <LevelPicker />
          <div className="qz-levels">
            {lv.map((x) => <span key={x.id} className={'qz-lv' + (x.done ? ' done' : '')}>{x.name} <b>{x.mastered}/{x.total}</b></span>)}
          </div>
          <p className="hint">{tf('{a} questions réussies sur {b} · {r} bonnes réponses, {w} erreurs au total.', { a: s.mastered, b: s.total, r: s.right, w: s.wrong })} {t('Chaque ouverture pose 5 questions ; quand toutes les questions d’un niveau sont réussies, le niveau suivant commence.')}</p>
          {practice > 0 ? <QuizCard key={practice} onDone={() => setPractice(0)} doneLabel={t('Terminer')} /> : <button type="button" className="btn" onClick={() => setPractice(1)}>{t('Cinq questions pour s’entraîner')}</button>}
          <div className="opt"><span className="spacer" /><button type="button" className="btn ghost" onClick={close}>{t('Fermer')}</button></div>
        </div>
      </div>
    </div>
  );
}
