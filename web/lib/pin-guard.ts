import { check, consume, LIMITS } from './rate-limit';
import { hashPin, verifyLegacyPin, verifyPin } from './pin';
import type { MutationTarget } from './storage';

export type PinCheck =
  | { ok: true; upgradedPinHash?: string }
  | { ok: false; status: 403; error: string }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Verifies the PIN on a PIN-protected link. Failures are counted per code and
 * further attempts are refused once the limit is reached. A correct legacy
 * plaintext PIN is returned re-hashed so the caller can replace it.
 */
export async function checkPin(code: string, target: MutationTarget, pin: string | undefined): Promise<PinCheck> {
  if (target.pinHash === null && target.legacyPin === null) return { ok: true };

  const key = `pinfail:${code}`;
  const gate = await check(key, LIMITS.pinFailures);
  if (!gate.ok) return { ok: false, status: 429, retryAfter: gate.retryAfter };

  let valid = false;
  let upgradedPinHash: string | undefined;
  if (pin !== undefined) {
    if (target.pinHash !== null) {
      valid = await verifyPin(pin, target.pinHash);
    } else if (target.legacyPin !== null && verifyLegacyPin(pin, target.legacyPin)) {
      valid = true;
      upgradedPinHash = await hashPin(pin);
    }
  }
  if (!valid) {
    await consume(key, LIMITS.pinFailures);
    return { ok: false, status: 403, error: pin === undefined ? 'PIN required' : 'Invalid PIN' };
  }
  return { ok: true, upgradedPinHash };
}
