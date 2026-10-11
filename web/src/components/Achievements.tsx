import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GROUPS, newlyMet, type Def, type Group } from '../lib/achievements';
import { badgeMarkup } from '../lib/badge';
import { chime } from '../lib/sound';
import { parse } from '../lib/dates';
import { useApp } from '../state/app';

/** The medal of an achievement, as a picture. */
export function Badge({ def, locked, size = 64 }: { def: Def; locked?: boolean; size?: number }): ReactNode {
  return <svg className="badge" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: badgeMarkup({ glyph: def.glyph, rank: def.rank, label: def.label, color: def.color, locked }) }} />;
}

/** Records the medals just earned (the date is saved for good) and announces them. */
export function AchievementWatcher(): ReactNode {
  const { ach, data, update, realToday, toast, setUi, t, tf } = useApp();
  const busy = useRef(false);
  useEffect(() => {
    const fresh = newlyMet(ach.defs, data);
    if (!fresh.length || busy.current) return;
    busy.current = true;
    update((d) => { for (const f of fresh) if (!d.ach[f.id]) d.ach[f.id] = realToday; });
    if (fresh.length <= 3) fresh.forEach((f) => toast({ kind: 'achievement', icon: '🏆', title: t('Succès débloqué !') + ' ' + f.title, body: f.desc, ttl: 7000 }));
    else toast({ kind: 'achievement', icon: '🏆', title: tf('{n} succès débloqués !', { n: fresh.length }), body: t('Regarde l’onglet Succès : chaque médaille devient un sticker.'), ttl: 12000 });
    if (data.prefs.remindSound !== false) chime('achievement');
    void setUi;
    busy.current = false;
  }, [ach.defs, data, update, realToday, toast, setUi, t, tf]);
  return null;
}

const GROUP_NAME: Record<Group, string> = { sessions: 'Séances', rhythm: 'Rythme et rattrapage', homework: 'Devoirs', planner: 'Mon planner' };

/** The trophy room. */
export function AchievementsTab(): ReactNode {
  const { ach, fmt, t, tf } = useApp();
  const [sel, setSel] = useState<string | null>(null);
  const unlockedOf = (d: Def): string | undefined => ach.unlocked[d.id];
  const total = ach.defs.length, got = ach.defs.filter((d) => unlockedOf(d)).length;
  const fams = new Map<string, Def[]>();
  ach.defs.forEach((d) => { const l = fams.get(d.family) || []; l.push(d); fams.set(d.family, l); });
  const chosen = sel ? ach.byId[sel] : undefined;
  const { currentStreak, bestStreak } = ach.stats;

  return (
    <div className="ach">
      <header className="ach-sum">
        <div className="ach-big">🏆 <b>{got}</b> / {total}</div>
        <div className="ach-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={got} aria-label={t('Succès débloqués')}><i style={{ width: (total ? (got / total) * 100 : 0) + '%' }} /></div>
        <div className="ach-streak">🔥 {tf('Série en cours : {n} j', { n: currentStreak })} · {tf('meilleure série : {n} j', { n: bestStreak })}</div>
      </header>

      {chosen && (
        <aside className="ach-detail" aria-live="polite">
          <Badge def={chosen} locked={!unlockedOf(chosen)} size={96} />
          <div>
            <h2>{chosen.title}</h2>
            <p>{chosen.desc}</p>
            <p className="hint">{unlockedOf(chosen)
              ? '✅ ' + tf('Débloqué le {d}', { d: fmt.long.format(parse(unlockedOf(chosen) as string)) }) + ' · ' + t('Utilisable comme sticker : Imprimer → Stickers et emojis → Succès.')
              : '🔒 ' + tf('Verrouillé : {v} / {n}', { v: Math.min(chosen.value, chosen.n), n: chosen.n })}</p>
          </div>
          <button type="button" className="btn ghost" onClick={() => setSel(null)}>{t('Fermer')}</button>
        </aside>
      )}

      {GROUPS.map((g) => {
        const list = [...fams.values()].filter((l) => l[0].group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="group">
            <h2>{t(GROUP_NAME[g])}</h2>
            <div className="ach-fams">
              {list.map((tiers) => {
                const next = tiers.find((d) => !unlockedOf(d));
                const doneN = tiers.filter((d) => unlockedOf(d)).length;
                return (
                  <article key={tiers[0].family} className="ach-fam">
                    <div className="ach-ft">
                      <b>{tiers[0].famName}</b>
                      <small>{next && tiers.length > 1 ? `→ ${Math.min(next.value, next.n)} / ${next.n} · ` : ''}{doneN === tiers.length ? '✔ ' : ''}<span className="ach-c">🏅 {doneN}/{tiers.length}</span></small>
                    </div>
                    <div className="ach-tiers">
                      {tiers.map((d) => {
                        const on = !!unlockedOf(d);
                        return (
                          <button key={d.id} type="button" className={'ach-b' + (on ? ' on' : '')} aria-pressed={sel === d.id}
                            aria-label={d.title + ' — ' + (on ? t('débloqué') : t('verrouillé'))} title={d.title} onClick={() => setSel(sel === d.id ? null : d.id)}>
                            <Badge def={d} locked={!on} size={56} />
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
