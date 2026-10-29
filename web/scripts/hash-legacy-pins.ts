/**
 * One-off: replace plaintext PINs stored before 1_safe_mutations with scrypt hashes.
 *
 *   DATABASE_URL=... npx tsx scripts/hash-legacy-pins.ts           # dry run: counts only
 *   DATABASE_URL=... npx tsx scripts/hash-legacy-pins.ts --apply   # writes
 *
 * Safe to re-run and safe alongside live traffic: each row is updated only if
 * its plaintext PIN is still the one that was hashed.
 */
import { hashPin } from '../lib/pin';
import { getPrisma } from '../lib/storage';

export async function hashLegacyPins({
  apply,
  codes,
}: {
  apply: boolean;
  /** Restrict to these codes (tests). */
  codes?: string[];
}): Promise<{ found: number; hashed: number }> {
  const db = getPrisma();
  const rows = await db.link.findMany({
    where: { pin: { not: null }, ...(codes ? { code: { in: codes } } : {}) },
    select: { code: true, pin: true },
  });
  let hashed = 0;
  if (apply) {
    for (const row of rows) {
      const pinHash = await hashPin(row.pin!);
      const result = await db.link.updateMany({
        where: { code: row.code, pin: row.pin },
        data: { pinHash, pin: null },
      });
      hashed += result.count;
    }
  }
  return { found: rows.length, hashed };
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  hashLegacyPins({ apply })
    .then(({ found, hashed }) => {
      console.log(apply ? `Hashed ${hashed} of ${found} plaintext PINs.` : `Dry run: ${found} plaintext PINs found. Re-run with --apply to hash them.`);
      return getPrisma().$disconnect();
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
