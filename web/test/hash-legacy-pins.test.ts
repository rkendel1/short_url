import { describe, expect, it } from 'vitest';
import { getPrisma } from '@/lib/storage';
import { verifyPin } from '@/lib/pin';
import { hashLegacyPins } from '@/scripts/hash-legacy-pins';
import { uniqueCode } from './helpers';

describe('scripts/hash-legacy-pins', () => {
  it('reports in dry-run mode and hashes with --apply', async () => {
    const code = uniqueCode('P');
    await getPrisma().link.create({
      data: { code, url: 'https://legacy.example/', created: 1, owner: 'scriptowner0123456789', pin: 'legacy-secret' },
    });

    const dry = await hashLegacyPins({ apply: false, codes: [code] });
    expect(dry.found).toBe(1);
    expect(dry.hashed).toBe(0);
    expect((await getPrisma().link.findUnique({ where: { code } }))?.pin).toBe('legacy-secret');

    expect(await hashLegacyPins({ apply: true, codes: [code] })).toEqual({ found: 1, hashed: 1 });
    const row = await getPrisma().link.findUnique({ where: { code } });
    expect(row?.pin).toBeNull();
    expect(await verifyPin('legacy-secret', row!.pinHash!)).toBe(true);
    expect((await hashLegacyPins({ apply: false, codes: [code] })).found).toBe(0);
  });
});
