/**
 * Signed-request format shared by the browser, the CLI and the server.
 *
 * Every mutation carries the owner identifier, the owner's P-256 public key
 * (SPKI, hex), a millisecond timestamp and an ECDSA P-256 / SHA-256 signature
 * (raw r||s, hex — the WebCrypto format) over the canonical string below.
 */

export const OWNER_HEADER = 'x-owner';
export const OWNER_KEY_HEADER = 'x-owner-key';
export const TIMESTAMP_HEADER = 'x-owner-timestamp';
export const SIGNATURE_HEADER = 'x-owner-signature';

export const SIGNATURE_VERSION = 'short-url-auth-v1';

/** Maximum accepted clock skew between client and server. */
export const MAX_SKEW_MS = 5 * 60 * 1000;

export function canonicalRequest(
  method: string,
  path: string,
  timestamp: string,
  bodySha256Hex: string
): string {
  return [SIGNATURE_VERSION, method.toUpperCase(), path, timestamp, bodySha256Hex].join('\n');
}
