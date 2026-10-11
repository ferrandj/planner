import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'app.css'), 'utf8');
// ignore comments
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('stylesheet is stable on every screen shape', () => {
  it('never switches layout on orientation (a nearly square screen would flip back and forth forever)', () => {
    expect(code).not.toMatch(/orientation\s*:/);
  });
  it('never sizes the page with the dynamic viewport height, which changes whenever a toolbar shows or hides', () => {
    expect(code).not.toMatch(/\d\s*dvh\b/);
  });
  it('layout breakpoints depend on width only', () => {
    const queries = [...code.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim()).filter((q) => !/^print$/.test(q) && !/prefers-/.test(q));
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) expect(q, q).not.toMatch(/height/);
  });
  it('reserves the scrollbar space so a scrollbar appearing cannot change the width', () => {
    expect(code).toMatch(/scrollbar-gutter:\s*stable/);
  });
});
