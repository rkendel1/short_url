import { kv as kvClient } from '@vercel/kv';

export interface LinkData {
  url: string;
  clicks: number;
  created: number;
  updated?: number;
  last?: number;
  owner: string;
}

let kv: typeof kvClient;

function getKvClient() {
  if (!kv) {
    const url = process.env.KV_REST_API_URL || process.env.KV_URL || process.env.REDIS_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Missing KV database configuration. Ensure KV_REST_API_URL (or KV_URL/REDIS_URL) and KV_REST_API_TOKEN are set.'
      );
    }

    kv = kvClient;
  }
  return kv;
}

export async function createLink(
  code: string,
  url: string,
  fingerprint: string,
  pin?: string
): Promise<void> {
  const client = getKvClient();
  const now = Math.floor(Date.now() / 1000);

  await Promise.all([
    client.set(`url:${code}`, url),
    client.set(`clicks:${code}`, 0),
    client.set(`created:${code}`, now),
    client.set(`owner:${code}`, fingerprint),
    pin ? client.set(`pin:${code}`, pin) : Promise.resolve(),
    client.sadd(`user:${fingerprint}`, code),
  ]);
}

export async function getLink(code: string): Promise<string | null> {
  const client = getKvClient();
  return await client.get<string>(`url:${code}`);
}

export async function incrementClicks(code: string): Promise<void> {
  const client = getKvClient();
  const now = Math.floor(Date.now() / 1000);
  await Promise.all([
    client.incr(`clicks:${code}`),
    client.set(`last:${code}`, now),
  ]);
}

export async function getLinkData(code: string): Promise<LinkData | null> {
  const client = getKvClient();
  const [url, clicks, created, owner, updated, last] = await Promise.all([
    client.get<string>(`url:${code}`),
    client.get<number>(`clicks:${code}`),
    client.get<number>(`created:${code}`),
    client.get<string>(`owner:${code}`),
    client.get<number>(`updated:${code}`),
    client.get<number>(`last:${code}`),
  ]);

  if (!url || !created || !owner) return null;

  return {
    url,
    clicks: clicks || 0,
    created,
    updated: updated ?? undefined,
    last: last ?? undefined,
    owner,
  };
}

export async function updateLinkUrl(
  code: string,
  newUrl: string,
  fingerprint: string,
  pin?: string
): Promise<boolean> {
  const client = getKvClient();
  const [owner, storedPin] = await Promise.all([
    client.get<string>(`owner:${code}`),
    client.get<string>(`pin:${code}`),
  ]);

  if (owner !== fingerprint) return false;
  if (storedPin && pin !== storedPin) return false;

  const now = Math.floor(Date.now() / 1000);
  await Promise.all([
    client.set(`url:${code}`, newUrl),
    client.set(`updated:${code}`, now),
  ]);

  return true;
}

export async function getUserLinks(fingerprint: string): Promise<string[]> {
  const client = getKvClient();
  return (await client.smembers(`user:${fingerprint}`)) || [];
}

export async function codeExists(code: string): Promise<boolean> {
  const client = getKvClient();
  return (await client.get(`url:${code}`)) !== null;
}
