import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const HDR = { 'Content-Type': 'application/json', 'X-Planner-Client': '1' };

export interface ServerState { rev: number; base: { s: Array<{ id: string; name: string }>; d: unknown[]; x: unknown[]; e: Array<{ id: string; subject: string }> }; data: Record<string, any> }

export async function getState(request: APIRequestContext): Promise<ServerState> {
  const r = await request.get('/api/state');
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as ServerState;
}

/** Empty the user data on the server (keeps the schedule) so every test starts from the same place. */
export async function resetData(request: APIRequestContext): Promise<void> {
  const s = await getState(request);
  const r = await request.put('/api/state', { headers: HDR, data: { baseRev: s.rev, data: {} } });
  expect(r.ok()).toBeTruthy();
}

/** Wait until the last change has reached the server. (The app saves ~0.4 s after the last change, so give the "pending" state time to appear first.) */
export async function waitSaved(page: Page): Promise<void> {
  await page.waitForTimeout(600);
  await expect(page.locator('#syncstat')).toHaveClass(/\bsaved\b/, { timeout: 10_000 });
}

export async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitSaved(page);
}

/** Collect console errors and requests that leave the app's own origin. */
export function watch(page: Page): { errors: string[]; external: string[] } {
  const out = { errors: [] as string[], external: [] as string[] };
  page.on('pageerror', (e) => out.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') out.errors.push(m.text()); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('blob:')) out.external.push(u); });
  return out;
}
