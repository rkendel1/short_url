import { describe, expect, it } from 'vitest';
import { getPrisma } from '@/lib/storage';
import { GET as myLinks } from '@/app/api/my-links/route';
import { LEGACY, LEGACY_OWNER } from './fixtures';
import { metadata, newOwner, plainRequest, remove, update, visit } from './helpers';

// These rows were written with the 0_init schema before 1_safe_mutations ran (see global-setup.ts).

describe('links created before this migration', () => {
  it('keep redirecting to the same destination', async () => {
    const response = await visit('legacyPlain');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://legacy.example/plain');
  });

  it('keep their data and start at revision 1 with a baseline history entry', async () => {
    const { data } = await metadata('legacyPin');
    expect(data).toMatchObject({ url: 'https://legacy.example/pinned', revision: 1, created: 1754000001, updated: 1754000100 });

    const baseline = await getPrisma().linkRevision.findMany({ where: { code: { in: LEGACY.map((l) => l.code) } } });
    expect(baseline).toHaveLength(LEGACY.length);
    expect(baseline.every((b) => b.action === 'baseline' && b.revision === 1)).toBe(true);
    expect(baseline.find((b) => b.code === 'legacyPin')?.at).toBe(1754000100);
  });

  it('are refused when their stored destination is not http(s)', async () => {
    const response = await visit('legacyScript');
    expect(response.status).toBe(403);
    expect(response.headers.get('location')).toBeNull();
  });

  it('are still listed for their owner', async () => {
    const response = await myLinks(plainRequest('GET', '/api/my-links', { headers: { 'x-fingerprint': LEGACY_OWNER } }));
    const { links } = await response.json();
    expect(links.map((l: { code: string }) => l.code)).toEqual(expect.arrayContaining(['legacyPlain', 'legacyPin']));
    expect(links.find((l: { code: string }) => l.code === 'legacyPin').protected).toBe(true);
  });
});

describe('legacy owners and PINs', () => {
  // One key claims the legacy owner identifier for the whole file (trust on first use).
  const legacy = newOwner(LEGACY_OWNER);

  it('bind their key on the first signed request, after which other keys are refused', async () => {
    expect((await update(legacy, 'legacyPlain', { url: 'https://legacy.example/moved', revision: 1 })).response.status).toBe(200);
    expect((await visit('legacyPlain')).headers.get('location')).toBe('https://legacy.example/moved');

    const other = newOwner(LEGACY_OWNER);
    expect((await update(other, 'legacyPlain', { url: 'https://evil.example/', revision: 2 })).response.status).toBe(403);
  });

  it('verify a plaintext legacy PIN once, then replace it with a hash', async () => {
    expect((await update(legacy, 'legacyPin', { url: 'https://legacy.example/x', revision: 1, pin: '13' })).response.status).toBe(403);
    let row = await getPrisma().link.findUnique({ where: { code: 'legacyPin' } });
    expect(row?.pin).toBe('12');

    expect((await update(legacy, 'legacyPin', { url: 'https://legacy.example/x', revision: 1, pin: '12' })).response.status).toBe(200);
    row = await getPrisma().link.findUnique({ where: { code: 'legacyPin' } });
    expect(row?.pin).toBeNull();
    expect(row?.pinHash).toMatch(/^scrypt\$/);

    expect((await update(legacy, 'legacyPin', { url: 'https://legacy.example/y', revision: 2, pin: '12' })).response.status).toBe(200);
  });

  it('protect deletion with the legacy PIN too', async () => {
    expect((await remove(legacy, 'legacyPinBrute', { revision: 1 })).response.status).toBe(403);
    expect((await remove(legacy, 'legacyPinBrute', { revision: 1, pin: '9876' })).response.status).toBe(200);
    expect((await visit('legacyPinBrute')).status).toBe(410);
  });
});
