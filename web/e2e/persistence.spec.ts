import { expect, test } from '@playwright/test';
import { getState, open, resetData, watch, waitSaved } from './helpers';

test.beforeEach(async ({ request }) => { await resetData(request); });

test('loads cleanly: no console errors, nothing fetched from other sites, safe headers', async ({ page, request }) => {
  const w = watch(page);
  await open(page);
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(w.errors).toEqual([]);
  expect(w.external).toEqual([]);
  const h = (await request.get('/')).headers();
  expect(h['content-security-policy']).toContain("script-src 'self'");
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
});

test('a ticked session is stored on the server and still ticked after a reload', async ({ page, request }) => {
  await open(page);
  const box = page.locator('input.chk').first();
  const id = await box.getAttribute('aria-label');
  await box.click();
  await waitSaved(page);
  const st = await getState(request);
  expect(Object.keys(st.data.done)).toHaveLength(1);
  await page.reload();
  await waitSaved(page);
  await page.getByRole('button', { name: 'Tout', exact: true }).click();
  await expect(page.locator('input.chk:checked')).toHaveCount(1);
  expect(id).toBeTruthy();
});

test('hand-in toggles, language, dark mode and title survive a reload', async ({ page, request }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Devoirs' }).click();
  await page.locator('article').first().getByRole('button', { name: /à rendre/ }).first().click();
  await page.getByRole('button', { name: 'Sombre' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('.editchip').click();
  const title = page.getByLabel(/App title|Titre de l'application/);
  await title.fill('My own planner');
  await waitSaved(page);
  await page.reload();
  await waitSaved(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My own planner');
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
  await expect(page.getByRole('tab', { name: 'Schedule' })).toBeVisible();
  const d = (await getState(request)).data;
  expect(d.prefs).toMatchObject({ lang: 'en', mode: 'dark' });
  expect(Object.keys(d.rendu)).toHaveLength(1);
  expect(d.edits.app.title).toBe('My own planner');
});

test('renaming a subject is saved and shown everywhere; a blank name is refused', async ({ page, request }) => {
  await open(page);
  await page.getByRole('button', { name: /Édition/ }).click();
  const name = page.getByLabel('Nom complet').first();
  await name.fill('Linear algebra');
  await waitSaved(page);
  await name.fill('');
  await page.getByLabel('Code').first().focus();
  await expect(name).toHaveValue('Linear algebra');
  await page.getByRole('tab', { name: 'Planning' }).click();
  await expect(page.getByText('Linear algebra').first()).toBeVisible();
  expect((await getState(request)).data.edits['s:m1'].name).toBe('Linear algebra');
});

test('notes: text, link, image upload (resized in the browser) and a document, all kept after reload', async ({ page, request }, info) => {
  await open(page);
  await page.getByRole('button', { name: /Notes et pièces jointes/ }).first().click();
  await page.getByLabel('Ajouter une note').fill('bring the calculator');
  await page.getByRole('button', { name: 'Ajouter le texte' }).click();
  await page.getByLabel('Ajouter un lien').fill('https://example.org/course');
  await page.getByRole('button', { name: 'Ajouter le lien' }).click();
  // a real 2400x1200 PNG made in the browser, to prove it gets shrunk to <= 1600 px
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1200;
    const x = c.getContext('2d')!; x.fillStyle = '#c33'; x.fillRect(0, 0, 2400, 1200);
    const b = await new Promise<Blob>((r) => c.toBlob((bb) => r(bb!), 'image/png'));
    return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  await page.getByLabel('Ajouter des images ou des fichiers').setInputFiles([
    { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png) },
    { name: 'syllabus.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') }
  ]);
  await expect(page.locator('.nitem img')).toHaveCount(1);
  await expect(page.getByRole('link', { name: /syllabus\.pdf/ })).toBeVisible();
  await waitSaved(page);
  const notes = Object.values((await getState(request)).data.notes)[0] as Array<{ k: string; f?: string; d?: string }>;
  expect(notes.map((n) => n.k).sort()).toEqual(['file', 'img', 'link', 'text']);
  expect(notes.every((n) => !n.d)).toBe(true);                                  // nothing stored inside the state file
  const img = notes.find((n) => n.k === 'img')!;
  const served = await request.get('/api/files/' + img.f);
  expect(served.headers()['content-type']).toBe('image/jpeg');
  const dims = await page.evaluate(() => { const i = document.querySelector('.nitem img') as HTMLImageElement; return [i.naturalWidth, i.naturalHeight]; });
  expect(dims[0]).toBe(1600); expect(dims[1]).toBe(800);
  const pdf = notes.find((n) => n.k === 'file')!;
  const dl = await request.get('/api/files/' + pdf.f + '?name=syllabus.pdf');
  expect(dl.headers()['content-disposition']).toContain('attachment');
  expect(dl.headers()['content-type']).toBe('application/octet-stream');
  await page.reload(); await waitSaved(page);
  await page.getByRole('button', { name: /Notes et pièces jointes/ }).first().click();
  await expect(page.locator('.nitem')).toHaveCount(4);
  await expect(page.locator('.nitem img')).toHaveJSProperty('complete', true);
  await info.attach('notes', { body: await page.screenshot(), contentType: 'image/png' });
});

test('print tab: add a sticker, it is saved, and the printed page hides the app chrome', async ({ page, request }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Imprimer' }).click();
  await page.getByRole('button', { name: 'Stickers et emojis' }).click();
  await page.getByRole('button', { name: /Ajouter : Ours/ }).click();
  await waitSaved(page);
  const stickers = Object.values((await getState(request)).data.stickers)[0] as unknown[];
  expect(stickers).toHaveLength(1);
  await page.reload(); await waitSaved(page);
  await page.getByRole('tab', { name: 'Imprimer' }).click();
  await expect(page.locator('.sheet .stk')).toHaveCount(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sheet')).toBeVisible();
  await expect(page.locator('header.top')).toBeHidden();
  await expect(page.locator('.tabs')).toBeHidden();
  await expect(page.locator('#syncstat')).toBeHidden();
});

test('dragging a sticker on the sheet moves it and the position is kept', async ({ page, request }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Imprimer' }).click();
  await page.getByRole('button', { name: 'Stickers et emojis' }).click();
  await page.getByRole('button', { name: /Ajouter : Chat/ }).click();
  const stk = page.locator('.sheet .stk.ed');
  const sheet = page.locator('.sheet');
  await sheet.evaluate((el) => el.scrollIntoView({ block: 'center' }));        // like a user scrolling to the sheet
  const sb = (await sheet.boundingBox())!, kb = (await stk.boundingBox())!;
  await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width * 0.7, sb.y + sb.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => {
    const list = Object.values((await getState(request)).data.stickers ?? {})[0] as Array<{ x: number; y: number }> | undefined;
    const s = list?.[0];
    return s ? [Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10] : null;
  }, { timeout: 10_000 }).toEqual([0.7, 0.6]);
});
