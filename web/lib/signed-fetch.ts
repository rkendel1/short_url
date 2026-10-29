import { ensureSigningKey, signChallenge } from './fingerprint';
import {
  OWNER_HEADER,
  OWNER_KEY_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  canonicalRequest,
} from './request-signing';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Sends a mutation signed with this browser's key (see lib/request-signing.ts). */
export async function signedFetch(
  fingerprint: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const publicKey = await ensureSigningKey();
  if (!publicKey) {
    throw new Error('This browser cannot create a signing key, so it cannot change links');
  }
  const raw = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = await signChallenge(canonicalRequest(method, path, timestamp, await sha256Hex(raw)));
  if (!signature) {
    throw new Error('Could not sign the request');
  }
  return fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      [OWNER_HEADER]: fingerprint,
      [OWNER_KEY_HEADER]: publicKey,
      [TIMESTAMP_HEADER]: timestamp,
      [SIGNATURE_HEADER]: signature,
    },
    body: raw,
  });
}
