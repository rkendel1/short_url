import { Redis } from '@upstash/redis';

export interface LinkData {
  code: string;
  url: string;
  clicks: number;
  created: number;
  updated?: number;
  last?: number;
  owner: string;
}

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Missing Vercel KV/Redis configuration. Ensure KV_REST_API_URL and KV_REST_API_TOKEN are set from your Vercel integration.'
      );
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

export async function createLink(
  code: string,
  url: string,
  fingerprint: string,
  pin?: string
): Promise<void> {
  const db = getRedis();
  const now = Math.floor(Date.now() / 1000);

  await Promise.all([
    db.set(`url:${code}`, url),
    db.set(`clicks:${code}`, 0),
    db.set(`created:${code}`, now),
    db.set(`owner:${code}`, fingerprint),
    pin ? db.set(`pin:${code}`, pin) : Promise.resolve(),
    db.sadd(`user:${fingerprint}`, code),
  ]);
}

export async function getLink(code: string): Promise<string | null> {
  const db = getRedis();
  const url = await db.get(`url:${code}`) as string | null;
  return url || null;
}

export async function incrementClicks(code: string): Promise<void> {
  const db = getRedis();
  const now = Math.floor(Date.now() / 1000);

  await Promise.all([
    db.incr(`clicks:${code}`),
    db.set(`last:${code}`, now),
  ]);
}

export async function getLinkData(code: string): Promise<LinkData | null> {
  const db = getRedis();
  const [url, clicks, created, owner, updated, last] = await Promise.all([
    db.get(`url:${code}`) as Promise<string | null>,
    db.get(`clicks:${code}`) as Promise<number | null>,
    db.get(`created:${code}`) as Promise<number | null>,
    db.get(`owner:${code}`) as Promise<string | null>,
    db.get(`updated:${code}`) as Promise<number | null>,
    db.get(`last:${code}`) as Promise<number | null>,
  ]);

  if (!url || !created || !owner) return null;

  return {
    code,
    url,
    clicks: clicks || 0,
    created,
    updated: updated || undefined,
    last: last || undefined,
    owner,
  };
}

export async function updateLinkUrl(
  code: string,
  newUrl: string,
  fingerprint: string,
  pin?: string
): Promise<boolean> {
  const db = getRedis();
  const [owner, storedPin] = await Promise.all([
    db.get(`owner:${code}`) as Promise<string | null>,
    db.get(`pin:${code}`) as Promise<string | null>,
  ]);

  if (owner !== fingerprint) return false;
  if (storedPin && pin !== storedPin) return false;

  const now = Math.floor(Date.now() / 1000);
  await Promise.all([
    db.set(`url:${code}`, newUrl),
    db.set(`updated:${code}`, now),
  ]);

  return true;
}

export async function getUserLinks(fingerprint: string): Promise<string[]> {
  const db = getRedis();
  const codes = await db.smembers(`user:${fingerprint}`) as Promise<string[]>;
  return codes || [];
}

export async function codeExists(code: string): Promise<boolean> {
  const db = getRedis();
  const url = await db.get(`url:${code}`);
  return url !== null;
}

export async function deleteLink(code: string): Promise<void> {
  const db = getRedis();
  const owner = await db.get<string>(`owner:${code}`);

  if (owner) {
    await db.srem(`user:${owner}`, code);
  }

  await Promise.all([
    db.del(`url:${code}`),
    db.del(`clicks:${code}`),
    db.del(`created:${code}`),
    db.del(`updated:${code}`),
    db.del(`last:${code}`),
    db.del(`owner:${code}`),
    db.del(`pin:${code}`),
  ]);
}
