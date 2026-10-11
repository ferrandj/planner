import { expect, test } from '@playwright/test';
import { HDR, getState, open, resetData, waitSaved } from './helpers';

test.beforeEach(async ({ request }) => { await resetData(request); });

test('a mistaken wipe can be undone from the Backups section', async ({ page, request }) => {
  await open(page);
  // build up some real data through the UI
  await page.locator('input.chk').nth(0).click();
  await page.locator('input.chk').nth(1).click();
  await page.getByRole('tab', { name: 'Devoirs' }).click();
  await page.locator('article').first().getByRole('button', { name: /à rendre/ }).first().click();
  await waitSaved(page);
  const good = await getState(request);
  expect(Object.keys(good.data.done)).toHaveLength(2);

  // something erases it (simulated here as a direct write)
  const bad = await request.put('/api/state', { headers: HDR, data: { baseRev: good.rev, data: { ...good.data, done: {}, rendu: {} } } });
  expect(bad.ok()).toBeTruthy();

  await page.reload(); await waitSaved(page);
  await page.getByRole('button', { name: /Édition/ }).click();
  await page.getByRole('button', { name: /Sauvegardes et export/ }).click();
  const list = page.getByRole('button', { name: 'Restaurer' });
  await expect(list.first()).toBeVisible();
  page.on('dialog', (d) => void d.accept());
  // newest snapshot = the state right before the wipe
  await list.first().click();
  await expect(page.getByText('Sauvegarde restaurée.')).toBeVisible();
  const restored = await getState(request);
  expect(Object.keys(restored.data.done)).toHaveLength(2);
  expect(Object.keys(restored.data.rendu)).toHaveLength(1);
  // the wiped version was itself snapshotted first, so even the restore can be undone
  const backups = (await (await request.get('/api/backups')).json()) as { backups: Array<{ tag: string }> };
  expect(backups.backups.some((b) => b.tag === 'pre-restore')).toBe(true);
});

test('export downloads the data and importing it into an emptied planner brings everything back', async ({ page, request }) => {
  await open(page);
  await page.locator('input.chk').nth(0).click();
  await page.getByRole('button', { name: /Édition/ }).click();
  await page.getByLabel('Nom complet').first().fill('Exported name');
  await waitSaved(page);
  await page.getByRole('button', { name: /Sauvegardes et export/ }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Exporter (JSON)' }).click()]);
  const path = await dl.path();
  expect(dl.suggestedFilename()).toMatch(/^planner-export-\d{4}-\d{2}-\d{2}\.json$/);
  await resetData(request);
  await page.reload(); await waitSaved(page);
  await page.getByRole('button', { name: /Édition/ }).click();
  await page.getByRole('button', { name: /Sauvegardes et export/ }).click();
  page.on('dialog', (d) => void d.accept());
  await page.locator('#imp-file').setInputFiles(path!);
  await expect(page.getByText('Import terminé.')).toBeVisible();
  await waitSaved(page);
  const s = await getState(request);
  expect(Object.keys(s.data.done)).toHaveLength(1);
  expect(s.data.edits['s:m1'].name).toBe('Exported name');
});
