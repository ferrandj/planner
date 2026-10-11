import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const pub = join(__dirname, '..', 'public');
const manifest = JSON.parse(readFileSync(join(pub, 'manifest.webmanifest'), 'utf8')) as {
  name: string; short_name: string; display: string; start_url: string; scope: string; theme_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
};
const size = (file: string): [number, number] => { const b = readFileSync(join(pub, file)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

describe('installable web app (Android and desktop Chrome)', () => {
  it('is called Planner and opens like an app, in its own window', () => {
    expect(manifest.name).toBe('Planner');
    expect(manifest.short_name).toBe('Planner');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('.');
    expect(manifest.scope).toBe('.');                       // relative: also works behind a reverse-proxy sub-path
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('has the calendar icon as real PNG files at 192 and 512 px, plus a maskable one', () => {
    const png = manifest.icons.filter((i) => i.type === 'image/png');
    for (const want of ['192x192', '512x512']) {
      const i = png.find((x) => x.sizes === want && x.purpose === 'any');
      expect(i, want).toBeTruthy();
      expect(existsSync(join(pub, i!.src))).toBe(true);
      const [w, h] = size(i!.src);
      expect(`${w}x${h}`).toBe(want);
    }
    const m = png.find((x) => x.purpose === 'maskable');
    expect(m).toBeTruthy();
    expect(size(m!.src)).toEqual([512, 512]);
  });
  it('the page links the manifest and the iOS icon, both of which exist', () => {
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toMatch(/rel="manifest" href="\/manifest\.webmanifest"/);
    expect(html).toMatch(/rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
    expect(size('apple-touch-icon.png')).toEqual([180, 180]);
    expect(html).toMatch(/<title>Planner<\/title>/);
  });
  it('the service worker never touches the data (/api/) and only caches the app itself', () => {
    const sw = readFileSync(join(pub, 'sw.js'), 'utf8');
    expect(sw).toMatch(/pathname\.includes\('\/api\/'\)[^\n]*\n?[^\n]*return;/);
    expect(sw).toMatch(/req\.method !== 'GET'\) return/);
    expect(sw).not.toMatch(/cache\.put\([^)]*api/i);
  });
});
