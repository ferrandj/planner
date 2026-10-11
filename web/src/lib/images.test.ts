import { cleanLink, prepFile } from './images';

describe('cleanLink', () => {
  it('adds https and keeps http(s) / mailto', () => {
    expect(cleanLink('example.org/a')).toBe('https://example.org/a');
    expect(cleanLink(' http://a.b ')).toBe('http://a.b');
    expect(cleanLink('mailto:a@b.c')).toBe('mailto:a@b.c');
  });
  it('refuses dangerous or empty links', () => {
    expect(cleanLink('javascript:alert(1)')).toBeNull();
    expect(cleanLink('data:text/html,<b>x</b>')).toBeNull();
    expect(cleanLink('file:///etc/passwd')).toBeNull();
    expect(cleanLink('   ')).toBeNull();
  });
});

describe('prepFile', () => {
  it('uploads non-images untouched', async () => {
    const f = new File(['hello'], 'a.pdf', { type: 'application/pdf' });
    expect(await prepFile(f)).toMatchObject({ name: 'a.pdf', type: 'application/pdf', kind: 'file' });
  });
  it('treats svg as a downloadable file, gif as an image kept as is', async () => {
    expect(await prepFile(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))).toMatchObject({ kind: 'file' });
    expect(await prepFile(new File(['GIF89a'], 'a.gif', { type: 'image/gif' }))).toMatchObject({ kind: 'img', type: 'image/gif' });
  });
  it('rejects files over the limit (and says which)', async () => {
    const big = new File(['x'], 'big.bin', { type: 'application/octet-stream' });
    Object.defineProperty(big, 'size', { value: 26 * 1048576 });
    expect(await prepFile(big)).toEqual({ tooBig: 'big.bin' });
  });
  it('an image the browser cannot decode is still kept (as a plain file)', async () => {
    const orig = URL.createObjectURL;
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => {};
    const RealImage = globalThis.Image;
    globalThis.Image = class { onerror: (() => void) | null = null; set src(_: string) { setTimeout(() => this.onerror?.(), 0); } } as unknown as typeof Image;
    try {
      expect(await prepFile(new File(['x'], 'p.heic', { type: 'image/heic' }))).toMatchObject({ name: 'p.heic', kind: 'file', type: 'image/heic' });
    } finally { globalThis.Image = RealImage; URL.createObjectURL = orig; }
  });
});
