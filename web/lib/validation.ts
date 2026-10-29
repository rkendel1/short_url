export const MAX_URL_LENGTH = 2048;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 128;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Destinations must be absolute http(s) URLs with a host and no embedded credentials. */
export function checkDestination(input: unknown): Checked<string> {
  if (typeof input !== 'string' || input.trim() === '') {
    return { ok: false, error: 'Missing destination URL' };
  }
  const raw = input.trim();
  if (raw.length > MAX_URL_LENGTH) {
    return { ok: false, error: `Destination URL must be at most ${MAX_URL_LENGTH} characters` };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https destinations are allowed' };
  }
  if (!url.hostname) {
    return { ok: false, error: 'Destination URL must include a host' };
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Destination URL must not contain credentials' };
  }
  return { ok: true, value: url.href };
}

/** Whether a stored destination may be redirected to (guards rows created before validation). */
export function isRedirectable(stored: string): boolean {
  return checkDestination(stored).ok;
}

export function parsePin(input: unknown): Checked<string | undefined> {
  if (input === undefined || input === null || input === '') {
    return { ok: true, value: undefined };
  }
  if (typeof input !== 'string') {
    return { ok: false, error: 'PIN must be a string' };
  }
  if (input.length < MIN_PIN_LENGTH || input.length > MAX_PIN_LENGTH) {
    return {
      ok: false,
      error: `PIN must be ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} characters`,
    };
  }
  return { ok: true, value: input };
}

/** Expected revision for optimistic concurrency; `missing` means the client sent none. */
export function checkRevision(input: unknown): Checked<number> | { ok: false; missing: true; error: string } {
  if (input === undefined || input === null) {
    return { ok: false, missing: true, error: 'Missing revision: fetch the link and send its current revision' };
  }
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1) {
    return { ok: false, error: 'revision must be a positive integer' };
  }
  return { ok: true, value: input };
}
