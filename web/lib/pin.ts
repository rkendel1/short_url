import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// scrypt with N=2^15, r=8, p=1 (OWASP minimum is N=2^17 with r=8 for
// passwords; PINs are additionally protected by per-link attempt limits).
const LOG_N = 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function derive(pin: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function params(logN: number, r: number, p: number): ScryptOptions {
  return { N: 2 ** logN, r, p, maxmem: 256 * 2 ** logN * r };
}

/** Returns `scrypt$<logN>$<r>$<p>$<salt b64>$<hash b64>`. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(pin, salt, params(LOG_N, R, P));
  return ['scrypt', LOG_N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPin(pin: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [logN, r, p] = parts.slice(1, 4).map(Number);
  if (![logN, r, p].every(Number.isSafeInteger) || logN < 10 || logN > 20) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  const actual = await derive(pin, salt, params(logN, r, p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Constant-time comparison for PINs stored in plaintext before hashing was introduced. */
export function verifyLegacyPin(pin: string, stored: string): boolean {
  const a = Buffer.from(pin);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
