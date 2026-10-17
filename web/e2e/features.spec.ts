import { expect, test } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getState, open, resetData, watch, waitSaved } from './helpers';

test.beforeEach(async ({ request }) => { await resetData(request); });

// The calendar used to flicker forever (a layout that flipped with the window's orientation on near-square screens).
// A stable page has the same size and position for every element we sample, over time.
for (const [w, h] of [[800, 800], [900, 880], [1000, 1010], [1100, 1100], [820, 700]] as const) {
  test(`layout stays still on a ${w}×${h} window (no flicker)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const watcher = watch(page);
    await open(page);
    const monthBtn = page.getByRole('button', { name: 'Mois', exact: true });
    if (await monthBtn.isVisible()) await monthBtn.click();                       // only shown on narrow layouts
    const sample = (): Promise<string> => page.evaluate(() => {
      const r = (s: string): string => { const el = document.querySelector(s); if (!el) return s + ':none'; const b = el.getBoundingClientRect(); return [s, Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)].join(','); };
      return ['.split', '.pane-list', '.pane-month', '.cal', '.themebar', '.nb'].map(r).join('|') + '|' + document.documentElement.scrollWidth + ',' + document.documentElement.scrollHeight;
    });
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) { seen.add(await sample()); await page.waitForTimeout(150); }
    expect([...seen]).toHaveLength(1);
    expect(watcher.errors).toEqual([]);
  });
}

/** Pretend it is `days` days from now, so that the demo schedule (which starts tomorrow) has classes behind. */
async function simulate(page: import('@playwright/test').Page, days: number): Promise<void> {
  const d = new Date(Date.now() + days * 864e5);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.getByText('Tester avec une autre date').click();
  await page.locator('#simdate').fill(iso);
  const close = page.getByRole('dialog').getByRole('button').first();
  if (await close.isVisible().catch(() => false)) await close.click();
}

test('automatic catch-up: the switch and the limit are saved, tiles appear, nothing late is lost', async ({ page, request }) => {
  await open(page);
  await simulate(page, 25);
  const lateBefore = await page.locator('.lb-n').textContent();
  expect(Number(lateBefore)).toBeGreaterThan(0);                     // the reference schedule has classes already past
  await page.getByRole('switch', { name: /Rattrapage automatique/ }).click();
  await expect(page.locator('.st.plan').first()).toBeVisible();
  const box = page.getByLabel('Max. de suite par matière');
  await box.fill('2');
  await waitSaved(page);
  let st = await getState(request);
  expect(st.data.prefs).toMatchObject({ auto: true, autoMax: 2 });
  expect(Object.keys(st.data.done)).toHaveLength(0);                 // planning never ticks or hides anything
  expect(Object.keys(st.data.hidden)).toHaveLength(0);

  await page.reload();                                               // (the simulated date is not saved: back to the real day)
  await waitSaved(page);
  await expect(page.getByRole('switch', { name: /Rattrapage automatique/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Max. de suite par matière')).toHaveValue('2');
  await simulate(page, 25);
  await expect(page.locator('.lb-n')).toHaveText(lateBefore as string);

  // ticking a catch-up tile ticks the real class and the counter goes down
  await page.locator('.st.plan').first().locator('xpath=ancestor::li').getByRole('checkbox').click();
  await waitSaved(page);
  st = await getState(request);
  expect(Object.keys(st.data.done)).toHaveLength(1);
  await expect(page.locator('.lb-n')).toHaveText(String(Number(lateBefore) - 1));

  await page.getByRole('switch', { name: /Rattrapage automatique/ }).click();
  await expect(page.locator('.st.plan')).toHaveCount(0);
});

test('manual catch-up: I choose the class and the hour for tomorrow, it is saved and kept after a reload', async ({ page, request }) => {
  await open(page);
  await simulate(page, 25);
  await page.getByRole('switch', { name: /Rattrapage automatique/ }).click();
  await page.getByRole('checkbox', { name: 'Je choisis moi-même mes rattrapages' }).check();
  await expect(page.locator('.st.plan')).toHaveCount(0);              // nothing is placed by itself
  await page.getByRole('button', { name: /Planifier demain/ }).click();
  const dlg = page.getByRole('dialog');
  const pick = dlg.getByLabel(/Cours à rattraper – Matin/);
  const options = await pick.locator('option').evaluateAll((l) => l.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
  expect(options.length).toBeGreaterThan(0);
  await pick.selectOption(options[0]);
  await dlg.getByLabel(/Heure – Matin/).selectOption('10:00');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await waitSaved(page);
  const st = await getState(request);
  expect(st.data.prefs).toMatchObject({ auto: true, autoManual: true });
  expect(st.data.picks[options[0]].time).toBe('10:00');                // the class and the hour I chose (the afternoon was only a suggestion)
  expect(Object.keys(st.data.picks).length).toBeLessThanOrEqual(2);
  expect(Object.keys(st.data.done)).toHaveLength(0);
  await expect(page.locator('.st.plan').first()).toBeVisible();
});

test('readable library: a note and a file added in the app appear as plain files in a subject / class folder on the server', async ({ page, request }) => {
  await open(page);
  await page.getByRole('button', { name: /Notes et pièces jointes/ }).first().click();
  await page.getByLabel('Ajouter une note').fill('Penser à relire le chapitre 3');
  await page.getByRole('button', { name: 'Ajouter le texte' }).click();
  await page.locator('#nt-file').setInputFiles({ name: 'mon cours.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 contenu du cours') });
  await expect(page.getByText('mon cours.pdf')).toBeVisible();
  await waitSaved(page);
  const root = ((await (await request.get('/api/library')).json()) as { dir: string }).dir;      // the folder the server says it uses (same machine)
  await expect.poll(() => existsSync(root) && readdirSync(root, { recursive: true }).map(String).some((f) => f.endsWith('mon cours.pdf')), { timeout: 15_000 }).toBe(true);
  const all = readdirSync(root, { recursive: true }).map(String);
  const notes = all.find((f) => f.endsWith('notes.txt')) as string;
  expect(notes.split(/[\\/]/)).toHaveLength(3);                                 // subject / class / notes.txt
  expect(readFileSync(join(root, notes), 'utf8')).toContain('Penser à relire le chapitre 3');
  expect(readFileSync(join(root, notes.replace('notes.txt', 'mon cours.pdf')), 'utf8')).toBe('%PDF-1.4 contenu du cours');
  expect(existsSync(join(root, 'LISEZ-MOI.txt'))).toBe(true);
});

test('add a subject and an assignment: kept after a reload; removed ones can be restored', async ({ page, request }) => {
  await open(page);
  await page.getByRole('button', { name: /Édition/ }).click();
  await page.getByRole('button', { name: '+ Ajouter une matière' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Nom complet').fill('Histoire');
  await dlg.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: '+ Ajouter un devoir' }).first().click();
  await dlg.getByLabel('Titre').fill('Dossier final');
  await dlg.getByRole('button', { name: 'Fermer' }).click();
  await waitSaved(page);
  await page.reload();
  await waitSaved(page);
  await page.getByRole('tab', { name: 'Devoirs' }).click();
  await expect(page.getByText('Dossier final').first()).toBeVisible();
  await expect(page.getByText('Histoire').first()).toBeVisible();
  const st = await getState(request);
  expect(st.data.extra.s).toHaveLength(1);
  expect(st.data.extra.d).toHaveLength(1);

  await page.getByRole('button', { name: 'Éditer : Dossier final' }).click();
  await dlg.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByText('Dossier final')).toHaveCount(0);
  await page.getByRole('button', { name: /Édition/ }).click();
  await page.getByRole('button', { name: /Supprimés/ }).click();
  await page.getByRole('button', { name: 'Restaurer' }).click();
  await waitSaved(page);
  await page.getByRole('button', { name: /Édition/ }).click();
  await expect(page.getByText('Dossier final').first()).toBeVisible();
});

test('installable app: manifest and icons are served, the service worker takes over, and the app still opens with the server unreachable', async ({ page, context, request }) => {
  const w = watch(page);
  await open(page);
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.name).toBe('Planner');
  for (const i of m.icons) expect((await request.get('/' + i.src)).ok(), i.src).toBeTruthy();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();                                                    // now controlled by the worker, and the page is stored
  await waitSaved(page);
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();   // the app opens from the stored copy ...
  await expect(page.locator('#syncstat')).toHaveClass(/offline|pending/, { timeout: 15_000 });   // ... and says it cannot reach the server
  await context.setOffline(false);
  expect(w.errors.filter((e) => !/Failed to load resource|net::ERR|fetch/i.test(e))).toEqual([]);
});

test('calendar day: the usual class of a subject is offered and added in one click, and kept after a reload', async ({ page, request }) => {
  await open(page);
  const monthBtn = page.getByRole('button', { name: 'Mois', exact: true });
  if (await monthBtn.isVisible()) await monthBtn.click();
  // the demo schedule has a weekly evening live per subject starting tomorrow; six weeks later nothing is left on that weekday
  const day = new Date(); day.setDate(day.getDate() + 1 + 42);
  const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(day);
  const cell = page.getByRole('button', { name: new RegExp('^' + label + ', ') });
  for (let i = 0; i < 5 && !(await cell.isVisible()); i++) await page.getByRole('button', { name: 'Mois suivant' }).click();
  await cell.click();
  const dlg = page.getByRole('dialog');
  const quick = dlg.locator('.quickadd .chips').first().getByRole('button').first();
  await expect(quick).toBeVisible();
  await quick.click();
  await expect(dlg.locator('ul.list li')).toHaveCount(1);
  await waitSaved(page);
  const st = await getState(request);
  expect(st.data.extra.e).toHaveLength(1);
  expect(st.data.extra.e[0].time).toBe('18:30 – 21:30');
  await page.reload();
  await waitSaved(page);
  expect((await getState(request)).data.extra.e).toHaveLength(1);
});

test('reminders: the settings window works and is saved; the server hands out its notification key', async ({ page, request }) => {
  await open(page);
  const k = await (await request.get('/api/push/key')).json();
  expect(Buffer.from(k.publicKey, 'base64url')).toHaveLength(65);
  await page.getByRole('button', { name: /Rappels/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').selectOption('30');
  await dlg.getByRole('checkbox', { name: /Son et vibration/ }).uncheck();
  await waitSaved(page);
  expect((await getState(request)).data.prefs).toMatchObject({ remindLead: 30, remindSound: false });
  await dlg.getByRole('button', { name: 'Tester le rappel' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Test du rappel' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test("today's agenda is on the first screen", async ({ page }) => {
  await open(page);
  await expect(page.getByRole('region', { name: 'Programme du jour' })).toBeVisible();
});

test('achievements: ticking a session unlocks medals that stay (even unticked), survive a reload and become stickers', async ({ page, request }) => {
  await open(page);
  await page.getByRole('button', { name: 'Tout', exact: true }).click();
  await page.locator('li.row input.chk').first().click();
  await expect(page.getByText(/Succès débloqué !/).first()).toBeVisible();
  await waitSaved(page);
  let st = await getState(request);
  const unlocked = Object.keys(st.data.ach);
  expect(unlocked).toEqual(expect.arrayContaining(['all|1']));
  expect(Object.keys(st.data.doneAt)).toHaveLength(1);

  await page.locator('li.row input.chk:checked').first().click();           // untick: nothing is taken away
  await waitSaved(page);
  st = await getState(request);
  expect(Object.keys(st.data.done)).toHaveLength(0);
  expect(Object.keys(st.data.ach)).toEqual(expect.arrayContaining(unlocked));

  await page.reload();
  await waitSaved(page);
  await page.getByRole('tab', { name: /Succès/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Succès débloqués' })).toHaveAttribute('aria-valuenow', String(unlocked.length));
  await expect(page.getByRole('button', { name: /Première séance suivie — débloqué/ })).toBeVisible();

  await page.getByRole('tab', { name: 'Imprimer' }).click();
  await page.getByRole('button', { name: 'Stickers et emojis' }).click();
  await page.getByRole('button', { name: /^Ajouter : Méduse/ }).click();
  await waitSaved(page);
  st = await getState(request);
  expect(Object.values(st.data.stickers).flat().map((s: any) => s.t)).toContain('rw:0');
});

test('English quiz: five questions at each opening (French + English) read aloud, wrong is fine and shows the right one in green, the progress is kept, and it can be switched off', async ({ page, request }) => {
  const st0 = await getState(request);
  expect((await request.put('/api/state', { headers: { 'Content-Type': 'application/json', 'X-Planner-Client': '1' }, data: { baseRev: st0.rev, data: { ...st0.data, prefs: { ...st0.data.prefs, quiz: true } } } })).ok()).toBeTruthy();
  await page.goto('/');
  const gate = page.getByRole('dialog', { name: /Une question avant d’entrer/ });
  await expect(gate).toBeVisible();
  await expect(gate.getByText('Quel est le mot anglais pour 🐱 ?')).toBeVisible();
  await expect(gate.getByText('What is the English word for 🐱?')).toBeVisible();
  await expect(gate.getByText('1 / 5')).toBeVisible();
  // the voice: a recording of the right answer is fetched and is a real mp3 (the page allows playing it)
  const recording = page.waitForResponse((r) => /\/audio\/en\/[0-9a-f]{12}\.mp3$/.test(r.url()));
  await gate.getByRole('button', { name: 'dog', exact: true }).click();                         // wrong
  const res = await recording;
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('audio/mpeg');
  const file = await request.get(res.url());                                                    // and the file itself is a real, non-empty recording
  expect(file.ok()).toBeTruthy();
  expect((await file.body()).length).toBeGreaterThan(1500);
  await expect(gate.locator('.qz-opt.ok')).toHaveText('cat ✓');
  await expect(gate.locator('.qz-opt.ko')).toHaveText('dog ✗');
  for (let i = 2; i <= 5; i++) {                                                                // the four other questions
    await gate.getByRole('button', { name: 'Question suivante' }).click();
    await expect(gate.getByText(`${i} / 5`)).toBeVisible();
    await gate.locator('.qz-opt').first().click();
  }
  await gate.getByRole('button', { name: 'Voir le résultat' }).click();
  await expect(gate.getByText(/bonnes réponses sur 5/)).toBeVisible();
  await gate.getByRole('button', { name: 'Entrer dans le planner' }).click();
  await expect(gate).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitSaved(page);
  const log = (await getState(request)).data.quiz;
  expect(log['en-a1-01']).toMatchObject({ ok: 0, ko: 1 });
  expect(Object.keys(log)).toHaveLength(5);

  await page.reload();                                                                           // asked again at the next opening, and the wrong one comes back first
  await expect(gate.getByText('What is the English word for 🐱?')).toBeVisible();
  await gate.getByRole('button', { name: 'Désactiver ce quiz' }).click();
  await waitSaved(page);
  expect((await getState(request)).data.prefs.quiz).toBe(false);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('what is new: the button opens it, the "show again" switch brings it back at the next start until switched off', async ({ page, request }) => {
  expect(typeof (await (await request.get('/api/version')).json()).version).toBe('string');
  await open(page);
  await page.getByRole('button', { name: /Nouveautés/ }).click();
  const dlg = page.getByRole('dialog', { name: /Nouveautés/ });
  await expect(dlg.getByText('Dernières nouveautés')).toBeVisible();
  await dlg.getByRole('switch', { name: 'Réafficher au prochain démarrage' }).check();
  await dlg.getByRole('button', { name: 'Compris' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.reload();                                                                 // next start-up
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('switch')).toBeChecked();
  await dlg.getByRole('switch').uncheck();
  await dlg.getByRole('button', { name: 'Compris' }).click();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
