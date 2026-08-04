import { kv } from '@vercel/kv';

export interface LinkData {
  url: string;
  clicks: number;
  created: number;
  updated?: number;
  last?: number;
  owner: string;
}

export async function createLink(
  code: string,
  url: string,
  fingerprint: string,
  pin?: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await Promise.all([
    kv.set(`url:${code}`, url),
    kv.set(`clicks:${code}`, 0),
    kv.set(`created:${code}`, now),
    kv.set(`owner:${code}`, fingerprint),
    pin ? kv.set(`pin:${code}`, pin) : Promise.resolve(),
    kv.sadd(`user:${fingerprint}`, code),
  ]);
}

export async function getLink(code: string): Promise<string | null> {
  return await kv.get<string>(`url:${code}`);
}

export async function incrementClicks(code: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await Promise.all([
    kv.incr(`clicks:${code}`),
    kv.set(`last:${code}`, now),
  ]);
}

export async function getLinkData(code: string): Promise<LinkData | null> {
  const [url, clicks, created, owner, updated, last] = await Promise.all([
    kv.get<string>(`url:${code}`),
    kv.get<number>(`clicks:${code}`),
    kv.get<number>(`created:${code}`),
    kv.get<string>(`owner:${code}`),
    kv.get<number>(`updated:${code}`),
    kv.get<number>(`last:${code}`),
  ]);

  if (!url || !created || !owner) return null;

  return {
    url,
    clicks: clicks || 0,
    created,
    updated,
    last,
    owner,
  };
}

export async function updateLinkUrl(
  code: string,
  newUrl: string,
  fingerprint: string,
  pin?: string
): Promise<boolean> {
  const [owner, storedPin] = await Promise.all([
    kv.get<string>(`owner:${code}`),
    kv.get<string>(`pin:${code}`),
  ]);

  if (owner !== fingerprint) return false;
  if (storedPin && pin !== storedPin) return false;

  const now = Math.floor(Date.now() / 1000);
  await Promise.all([
    kv.set(`url:${code}`, newUrl),
    kv.set(`updated:${code}`, now),
  ]);

  return true;
}

export async function getUserLinks(fingerprint: string): Promise<string[]> {
  return (await kv.smembers(`user:${fingerprint}`)) || [];
}

export async function codeExists(code: string): Promise<boolean> {
  return (await kv.get(`url:${code}`)) !== null;
}
