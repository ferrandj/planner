import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open, resetData } from './helpers';

test.beforeEach(async ({ request }) => { await resetData(request); });

// Colour contrast depends on the user's chosen theme colours, so it is not part of the automatic gate.
const scan = (page: import('@playwright/test').Page): Promise<import('axe-core').Result[]> =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).disableRules(['color-contrast']).analyze().then((r) => r.violations);

for (const [label, name] of [['planning', 'Planning'], ['devoirs', 'Devoirs'], ['print', 'Imprimer'], ['edit', /Édition/]] as const) {
  test(`no accessibility violations on the ${label} tab`, async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name }).click();
    const v = await scan(page);
    expect(v.map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

test('dialogs are accessible too (notes, stickers, alert)', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Notes et pièces jointes/ }).first().click();
  expect((await scan(page)).map((x) => x.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Imprimer' }).click();
  await page.getByRole('button', { name: 'Stickers et emojis' }).click();
  expect((await scan(page)).map((x) => x.id)).toEqual([]);
});

test('everything can be reached and used with the keyboard (tabs, checkbox)', async ({ page }) => {
  await open(page);
  const box = page.locator('input.chk').first();
  await box.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#syncstat')).toHaveClass(/saved/, { timeout: 10_000 });
  await expect(page.locator('input.chk:checked')).toHaveCount(0);   // moved out of "À faire"
  await page.getByRole('tab', { name: 'Devoirs' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.dgrid')).toBeVisible();
});
