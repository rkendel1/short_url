import { createHash, createPublicKey, verify, type KeyObject } from 'node:crypto';
import type { NextRequest } from 'next/server';
import {
  MAX_SKEW_MS,
  OWNER_HEADER,
  OWNER_KEY_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  canonicalRequest,
} from './request-signing';
import { bindOwnerKey } from './storage';

export type AuthResult =
  | { ok: true; owner: string; actor: string }
  | { ok: false; status: 401 | 403; error: string };

const OWNER_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const HEX_PATTERN = /^(?:[0-9a-f]{2})+$/i;

function parsePublicKey(hex: string): KeyObject | null {
  if (!HEX_PATTERN.test(hex) || hex.length > 400) return null;
  try {
    const key = createPublicKey({ key: Buffer.from(hex, 'hex'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

const unauthenticated = (error: string): AuthResult => ({ ok: false, status: 401, error });

/**
 * Verifies that the request was signed by the key bound to its owner.
 * The first signed request for an owner binds its key (trust on first use);
 * every later request must be signed by that same key.
 * `rawBody` is the exact body sent: JSON text, or raw bytes for uploads.
 */
export async function authenticate(request: NextRequest, rawBody: string | Uint8Array): Promise<AuthResult> {
  const owner = request.headers.get(OWNER_HEADER);
  const keyHex = request.headers.get(OWNER_KEY_HEADER);
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const signatureHex = request.headers.get(SIGNATURE_HEADER);

  if (!owner || !keyHex || !timestamp || !signatureHex) {
    return unauthenticated('Signed request required: see API_INTEGRATION.md');
  }
  if (!OWNER_PATTERN.test(owner)) return unauthenticated('Invalid owner identifier');
  if (!/^\d{1,16}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > MAX_SKEW_MS) {
    return unauthenticated('Request timestamp is missing or outside the allowed window');
  }
  const key = parsePublicKey(keyHex);
  if (!key) return unauthenticated('Owner key must be a P-256 public key (SPKI, hex)');
  if (!/^[0-9a-f]{128}$/i.test(signatureHex)) return unauthenticated('Invalid signature');

  const bodyHash = (
    typeof rawBody === 'string' ? createHash('sha256').update(rawBody, 'utf8') : createHash('sha256').update(rawBody)
  ).digest('hex');
  const message = canonicalRequest(request.method, request.nextUrl.pathname, timestamp, bodyHash);
  const valid = verify(
    'sha256',
    Buffer.from(message, 'utf8'),
    { key, dsaEncoding: 'ieee-p1363' },
    Buffer.from(signatureHex, 'hex')
  );
  if (!valid) return unauthenticated('Invalid signature');

  const spki = key.export({ format: 'der', type: 'spki' });
  const keyId = createHash('sha256').update(spki).digest('hex').slice(0, 32);
  const bound = await bindOwnerKey(owner, spki.toString('hex'), keyId);
  if (!bound) {
    return { ok: false, status: 403, error: 'This key is not the one registered for this owner' };
  }
  return { ok: true, owner, actor: `key:${keyId}` };
}
