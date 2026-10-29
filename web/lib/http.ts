import { NextResponse } from 'next/server';

const NO_STORE = { 'Cache-Control': 'no-store' };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function error(status: number, message: string, extra: Record<string, unknown> = {}): NextResponse {
  return json({ error: message, ...extra }, status);
}

export function tooManyRequests(retryAfter: number): NextResponse {
  return json({ error: 'Too many requests' }, 429, { 'Retry-After': String(retryAfter) });
}

/** Parses a JSON object body, returning the raw text too (it is what the signature covers). */
export async function readJsonBody(
  request: Request
): Promise<{ ok: true; raw: string; body: Record<string, unknown> } | { ok: false }> {
  const raw = await request.text();
  if (raw.length > 16 * 1024) return { ok: false };
  if (raw === '') return { ok: true, raw, body: {} };
  try {
    const body = JSON.parse(raw);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return { ok: false };
    return { ok: true, raw, body };
  } catch {
    return { ok: false };
  }
}
