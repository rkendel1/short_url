import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as qr } from '@/app/api/qr/route';
import { create, freezeTimeAtWindowStart, newOwner, plainRequest, update, uniqueCode } from './helpers';

describe('rate limiting', () => {
  beforeEach(() => {
    freezeTimeAtWindowStart();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('limits link creation per client IP', async () => {
    const owner = newOwner();
    const ip = '192.0.2.10';
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      statuses.push((await create(owner, { url: `https://example.com/${i}` }, { ip })).response.status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
    // Another client is unaffected.
    expect((await create(owner, { url: 'https://example.com/other' }, { ip: '192.0.2.11' })).response.status).toBe(200);
  });

  it('limits edits per client IP and sends Retry-After', async () => {
    const owner = newOwner();
    const code = uniqueCode();
    await create(owner, { url: 'https://example.com/r', customCode: code });
    const ip = '192.0.2.20';
    let last: Response | undefined;
    for (let i = 0; i < 61; i++) {
      last = (await update(owner, code, { url: 'https://example.com/r', revision: 1 }, { ip })).response;
    }
    expect(last?.status).toBe(429);
    expect(Number(last?.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('limits QR generation per client IP', async () => {
    const ip = '192.0.2.30';
    let last = 0;
    for (let i = 0; i < 61; i++) {
      last = (await qr(plainRequest('GET', '/api/qr?code=abc&size=64', { ip }))).status;
    }
    expect(last).toBe(429);
  });
});

describe('QR parameters', () => {
  const get = (query: string) => qr(plainRequest('GET', `/api/qr?${query}`));

  it('uses the default size and accepts the bounds', async () => {
    expect((await get('code=abc')).status).toBe(200);
    expect((await get('code=abc&size=64')).status).toBe(200);
    expect((await get('code=abc&size=1024')).status).toBe(200);
  });

  it.each(['63', '1025', '100000', '-5', '12.5', 'abc', '', '1e3'])('rejects size=%s', async (size) => {
    expect((await get(`code=abc&size=${encodeURIComponent(size)}`)).status).toBe(400);
  });

  it('rejects a missing or malformed code', async () => {
    expect((await get('size=64')).status).toBe(400);
    expect((await get('code=../../x')).status).toBe(400);
  });
});
