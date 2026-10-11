import { expect, test } from '@playwright/test';
import { open, resetData, waitSaved, watch } from './helpers';

test.beforeEach(async ({ request }) => { await resetData(request); });

test('phone layout: no sideways scrolling on any tab, calendar/list switch works', async ({ page }) => {
  const w = watch(page);
  await open(page);
  const overflow = (): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const name of ['Planning', 'Devoirs', 'Imprimer', /Édition/]) {
    await page.getByRole(name instanceof RegExp ? 'button' : 'tab', { name }).click();
    expect(await overflow(), `tab ${String(name)}`).toBeLessThanOrEqual(1);
  }
  await page.getByRole('tab', { name: 'Planning' }).click();
  await page.getByRole('button', { name: 'Mois', exact: true }).click();
  await expect(page.locator('.cal')).toBeVisible();
  await expect(page.locator('.pane-list')).toBeHidden();
  await page.getByRole('button', { name: 'Liste' }).click();
  await expect(page.locator('.pane-list')).toBeVisible();
  expect(w.errors).toEqual([]);
});

test('phone: ticking works with a tap and is saved', async ({ page, request }) => {
  await open(page);
  await page.locator('input.chk').first().tap();
  await waitSaved(page);
  const s = (await (await request.get('/api/state')).json()) as { data: { done: object } };
  expect(Object.keys(s.data.done)).toHaveLength(1);
});
