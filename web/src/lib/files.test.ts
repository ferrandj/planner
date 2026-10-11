import { blobToDataUrl, dataUrlToBlob, fmtSize, noteSrc, uploadBlob } from './files';
import { FakeServer } from '../test/fakeServer';

describe('files', () => {
  it('noteSrc prefers the server file and builds a download URL', () => {
    expect(noteSrc({ f: 'abc' })).toBe('api/files/abc');
    expect(noteSrc({ f: 'abc', n: 'my file.pdf' }, true)).toBe('api/files/abc?name=my%20file.pdf');
    expect(noteSrc({ d: 'data:text/plain,hi' })).toBe('data:text/plain,hi');
    expect(noteSrc({})).toBe('');
  });
  it('data URL <-> blob round trip (base64 and plain)', async () => {
    const b64 = dataUrlToBlob('data:text/plain;base64,aGVsbG8=');
    expect(b64.type).toBe('text/plain');
    expect(await b64.text()).toBe('hello');
    expect(await dataUrlToBlob('data:text/plain,a%20b').text()).toBe('a b');
    expect(await blobToDataUrl(new Blob(['hi'], { type: 'text/plain' }))).toBe('data:text/plain;base64,aGk=');
  });
  it('fmtSize', () => {
    expect(fmtSize(10)).toBe('1 Ko');
    expect(fmtSize(2048)).toBe('2 Ko');
    expect(fmtSize(3 * 1048576)).toBe('3.0 Mo');
  });
  it('uploadBlob sends the type and the client header, and reports failures', async () => {
    const srv = new FakeServer();
    const r = await uploadBlob(new Blob(['abc']), 'image/png', srv.fetch as typeof fetch);
    expect(r.size).toBe(3);
    expect(srv.files.get(r.id)!.type).toBe('image/png');
    await expect(uploadBlob(new Blob(['x']), undefined, (async () => new Response('', { status: 413 })) as typeof fetch)).rejects.toThrow('HTTP 413');
  });
});
