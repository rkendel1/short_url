import type { NextRequest } from 'next/server';
import { getPrisma } from './storage';

// Fixed-window counters in Postgres, so limits hold across serverless instances.

export const LIMITS = {
  create: { limit: 20, windowSeconds: 60 },
  mutate: { limit: 60, windowSeconds: 60 },
  read: { limit: 120, windowSeconds: 60 },
  qr: { limit: 60, windowSeconds: 60 },
  // inline-demo calls server-to-server for every demo page view, so it needs headroom.
  inlineDemo: { limit: 600, windowSeconds: 60 },
  pinFailures: { limit: 5, windowSeconds: 15 * 60 },
} as const;

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

function windowOf(windowSeconds: number): { start: number; retryAfter: number } {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const start = nowSeconds - (nowSeconds % windowSeconds);
  return { start, retryAfter: start + windowSeconds - nowSeconds };
}

async function count(key: string, windowStart: number): Promise<number> {
  const row = await getPrisma().rateLimit.findUnique({
    where: { key_window: { key, window: windowStart } },
    select: { count: true },
  });
  return row?.count ?? 0;
}

/** Records one hit and refuses it once `limit` hits have been recorded in the current window. */
export async function consume(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<RateLimitResult> {
  const { start, retryAfter } = windowOf(windowSeconds);
  const rows = await getPrisma().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "window", "count") VALUES (${key}, ${start}, 1)
    ON CONFLICT ("key", "window") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;
  if (Math.random() < 0.01) {
    await getPrisma().rateLimit.deleteMany({ where: { window: { lt: start - 86400 } } });
  }
  return rows[0].count > limit ? { ok: false, retryAfter } : { ok: true };
}

/** Checks a limit without recording a hit (used to gate PIN attempts on prior failures). */
export async function check(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<RateLimitResult> {
  const { start, retryAfter } = windowOf(windowSeconds);
  return (await count(key, start)) >= limit ? { ok: false, retryAfter } : { ok: true };
}

/** Vercel sets x-forwarded-for itself and overwrites any client-supplied value. */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}
