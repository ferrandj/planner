import { expect, test } from '@playwright/test';
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
