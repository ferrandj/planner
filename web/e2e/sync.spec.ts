import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HDR, getState, open, resetData, waitSaved } from './helpers';

const here = dirname(fileURLToPath(import.meta.url));

test.beforeEach(async ({ request }) => { await resetData(request); });

test('two devices editing at the same time: nothing is lost on either side', async ({ browser, request }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await open(a); await open(b);
  const idsA = await a.locator('input.chk').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(idsA.length).toBeGreaterThan(3);
  // device B's save is held back so that A saves first and B is working on a stale revision
  await b.route('**/api/state', async (route) => { if (route.request().method() === 'PUT') await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
  await b.locator('input.chk').nth(0).click();
  await a.locator('input.chk').nth(1).click();
  await a.getByRole('tab', { name: 'Devoirs' }).click();
  await a.locator('article').first().getByRole('button', { name: /à rendre/ }).first().click();
  await waitSaved(a); await waitSaved(b);
  await expect.poll(async () => {
    const d = (await getState(request)).data;
    return [Object.keys(d.done).length, Object.keys(d.rendu).length];
  }, { timeout: 15_000 }).toEqual([2, 1]);
  // and both screens end up showing everything
  await b.getByRole('button', { name: 'Tout', exact: true }).click();
  await expect(b.locator('input.chk:checked')).toHaveCount(2, { timeout: 20_000 });
});

test('a change made on one device shows up on another without reloading', async ({ browser, request }) => {
  const a = await (await browser.newContext()).newPage();
  await open(a);
  const st = await getState(request);
  const r = await request.put('/api/state', { headers: HDR, data: { baseRev: st.rev, data: { ...st.data, prefs: { ...st.data.prefs, lang: 'es' } } } });
  expect(r.ok()).toBeTruthy();
  await a.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(a.getByRole('tab', { name: 'Calendario' })).toBeVisible({ timeout: 20_000 });
});

test('server unreachable: the edit is kept, the app says so, and it syncs when the server is back', async ({ page, request, context }) => {
  await open(page);
  await context.route('**/api/state', (r) => (r.request().method() === 'PUT' ? r.abort() : r.continue()));
  await page.locator('input.chk').first().click();
  await expect(page.locator('#syncstat')).toHaveClass(/offline/, { timeout: 10_000 });
  await expect(page.locator('#syncstat')).toContainText('Hors ligne');
  expect(Object.keys((await getState(request)).data.done ?? {})).toHaveLength(0);   // not on the server yet
  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('planner-cache-v1')!));
  expect(cached.dirty).toBe(true);
  expect(Object.keys(cached.data.done)).toHaveLength(1);                            // but safe in the browser
  await context.unroute('**/api/state');
  await waitSaved(page);
  expect(Object.keys((await getState(request)).data.done)).toHaveLength(1);
});

test('edits made while offline survive closing the tab and are saved the next time the app opens', async ({ browser, request }) => {
  const ctx = await browser.newContext();
  const p1 = await ctx.newPage();
  await open(p1);
  await ctx.route('**/api/state', (r) => (r.request().method() === 'PUT' ? r.abort() : r.continue()));
  await p1.getByRole('tab', { name: 'Devoirs' }).click();
  await p1.locator('article').first().getByRole('button', { name: /à rendre/ }).first().click();
  await expect(p1.locator('#syncstat')).toHaveClass(/offline/, { timeout: 10_000 });
  await p1.close();                                                                // tab closed, edit never reached the server
  await ctx.unroute('**/api/state');
  expect(Object.keys((await getState(request)).data.rendu ?? {})).toHaveLength(0);
  const p2 = await ctx.newPage();
  await open(p2);
  await expect.poll(async () => Object.keys((await getState(request)).data.rendu ?? {}).length, { timeout: 10_000 }).toBe(1);
  await p2.getByRole('tab', { name: 'Devoirs' }).click();
  await expect(p2.locator('article').first().getByRole('button', { name: /Maths? · rendu|· rendu/ }).first()).toBeVisible();
});

test('a brand-new browser can never wipe saved data (it loads the server state first)', async ({ browser, request }) => {
  const first = await (await browser.newContext()).newPage();
  await open(first);
  await first.locator('input.chk').first().click();
  await waitSaved(first);
  const before = await getState(request);
  const fresh = await (await browser.newContext()).newPage();                       // no local storage at all
  await open(fresh);
  await fresh.getByRole('tab', { name: /Édition/ }).click();
  await fresh.getByLabel('Nom complet').first().fill('Changed on a new device');
  await waitSaved(fresh);
  const after = await getState(request);
  expect(after.data.done).toEqual(before.data.done);                                // earlier data still there
  expect(after.data.edits['s:m1'].name).toBe('Changed on a new device');
});

test.describe('server restart', () => {
  let proc: ChildProcess; let dir: string;
  const PORT = 4190;
  const start = async (): Promise<void> => {
    proc = spawn('node', [join(here, '..', '..', 'server', 'index.js')], { env: { ...process.env, DATA_DIR: dir, PORT: String(PORT), PUBLIC_DIR: join(here, '..', 'dist') }, stdio: 'ignore' });
    await expect.poll(async () => { try { return (await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok; } catch { return false; } }, { timeout: 15_000 }).toBe(true);
  };
  test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'planner-restart-')); await start(); });
  test.afterAll(() => { proc?.kill(); rmSync(dir, { recursive: true, force: true }); });

  test('everything is still there after the server is stopped and started again', async ({ page }) => {
    const url = `http://127.0.0.1:${PORT}/`;
    await page.goto(url);
    await waitSaved(page);
    await page.locator('input.chk').first().click();
    await page.getByRole('button', { name: /Notes et pièces jointes/ }).first().click();
    await page.getByLabel('Ajouter une note').fill('survives a restart');
    await page.getByRole('button', { name: 'Ajouter le texte' }).click();
    await page.getByLabel('Ajouter des images ou des fichiers').setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('file survives too') });
    await expect(page.getByRole('link', { name: /a\.txt/ })).toBeVisible();
    await waitSaved(page);
    const fileHref = await page.getByRole('link', { name: /a\.txt/ }).getAttribute('href');
    proc.kill('SIGTERM');
    await expect.poll(async () => { try { await fetch(`http://127.0.0.1:${PORT}/healthz`); return true; } catch { return false; } }).toBe(false);
    await start();
    const st = (await (await fetch(`http://127.0.0.1:${PORT}/api/state`)).json()) as { data: { done: object; notes: Record<string, Array<{ v?: string }>> } };
    expect(Object.keys(st.data.done)).toHaveLength(1);
    expect(Object.values(st.data.notes)[0].some((n) => n.v === 'survives a restart')).toBe(true);
    const f = await fetch(`http://127.0.0.1:${PORT}/${fileHref}`);
    expect(await f.text()).toBe('file survives too');
    await page.goto(url);
    await waitSaved(page);
    await page.getByRole('button', { name: 'Tout', exact: true }).click();
    await expect(page.locator('input.chk:checked')).toHaveCount(1);
  });
});
