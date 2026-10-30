import { randomBytes } from 'node:crypto';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authenticate } from './auth';
import { error, tooManyRequests } from './http';
import { clientIp, consume, LIMITS } from './rate-limit';
import { getPrisma } from './storage';

// Storage for inline-demo (https://github.com/rkendel1/inline-demo). inline-demo has no
// database of its own; every row here belongs to the owner whose key signed the request.

export type DemoKind = 'video' | 'embed';

export interface Demo {
  id: string;
  title: string;
  kind: DemoKind;
  src: string;
  poster?: string;
  caption?: string;
  clicks: number;
  plays: number;
  created: number;
  updated?: number;
}

export type DemoInput = Pick<Demo, 'title' | 'kind' | 'src' | 'poster' | 'caption'>;

/** Rate limit, then signature: the shared front door of every owner-scoped route. */
export async function guard(
  request: NextRequest,
  rawBody: string | Uint8Array
): Promise<{ ok: true; owner: string } | { ok: false; response: NextResponse }> {
  const limited = await consume(`inline-demo:${clientIp(request)}`, LIMITS.inlineDemo);
  if (!limited.ok) return { ok: false, response: tooManyRequests(limited.retryAfter) };
  const auth = await authenticate(request, rawBody);
  if (!auth.ok) return { ok: false, response: error(auth.status, auth.error) };
  return { ok: true, owner: auth.owner };
}

// ---- validation ----

const SLOT_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isSlotName(name: string): boolean {
  return SLOT_PATTERN.test(name);
}

function optionalText(value: unknown, max: number): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'string' && value.length <= max ? value : null;
}

/** Validates a create (all required fields) or a patch (only the fields present). */
export function checkDemoInput(
  body: Record<string, unknown>,
  partial: boolean
): { ok: true; value: Partial<DemoInput> } | { ok: false; error: string } {
  const value: Partial<DemoInput> = {};
  const { title, kind, src } = body;
  if (title !== undefined || !partial) {
    if (typeof title !== 'string' || !title.trim() || title.length > 200) return { ok: false, error: 'title is required (max 200 chars)' };
    value.title = title.trim();
  }
  if (kind !== undefined || !partial) {
    if (kind !== 'video' && kind !== 'embed') return { ok: false, error: "kind must be 'video' or 'embed'" };
    value.kind = kind;
  }
  if (src !== undefined || !partial) {
    if (typeof src !== 'string' || !src.trim() || src.length > 2048) return { ok: false, error: 'src is required (max 2048 chars)' };
    value.src = src.trim();
  }
  for (const [field, max] of [['poster', 2048], ['caption', 500]] as const) {
    if (!(field in body)) continue;
    const text = optionalText(body[field], max);
    if (text === null) return { ok: false, error: `${field} must be a string (max ${max} chars)` };
    value[field] = text;
  }
  return { ok: true, value };
}

// ---- demos ----

type DemoRow = {
  id: string;
  title: string;
  kind: string;
  src: string;
  poster: string | null;
  caption: string | null;
  clicks: number;
  plays: number;
  created: bigint;
  updated: bigint | null;
};

const DEMO_FIELDS = {
  id: true, title: true, kind: true, src: true, poster: true, caption: true,
  clicks: true, plays: true, created: true, updated: true,
} as const;

function toDemo(row: DemoRow): Demo {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind as DemoKind,
    src: row.src,
    poster: row.poster ?? undefined,
    caption: row.caption ?? undefined,
    clicks: row.clicks,
    plays: row.plays,
    created: Number(row.created),
    updated: row.updated == null ? undefined : Number(row.updated),
  };
}

export async function listDemos(owner: string): Promise<Demo[]> {
  const rows = await getPrisma().inlineDemo.findMany({
    where: { owner },
    orderBy: { created: 'desc' },
    select: DEMO_FIELDS,
  });
  return rows.map(toDemo);
}

export async function getDemo(owner: string, id: string): Promise<Demo | null> {
  const row = await getPrisma().inlineDemo.findFirst({ where: { id, owner }, select: DEMO_FIELDS });
  return row ? toDemo(row) : null;
}

export async function createDemo(owner: string, input: DemoInput): Promise<Demo> {
  const row = await getPrisma().inlineDemo.create({
    data: {
      id: randomBytes(5).toString('hex'),
      owner,
      title: input.title,
      kind: input.kind,
      src: input.src,
      poster: input.poster ?? null,
      caption: input.caption ?? null,
      created: BigInt(Date.now()),
    },
    select: DEMO_FIELDS,
  });
  return toDemo(row);
}

export async function updateDemo(owner: string, id: string, patch: Partial<DemoInput>): Promise<Demo | null> {
  const data = {
    ...patch,
    poster: 'poster' in patch ? patch.poster ?? null : undefined,
    caption: 'caption' in patch ? patch.caption ?? null : undefined,
    updated: BigInt(Date.now()),
  };
  const { count } = await getPrisma().inlineDemo.updateMany({ where: { id, owner }, data });
  return count ? getDemo(owner, id) : null;
}

/** Deletes the demo; slots pointing at it go with it (FK cascade). */
export async function deleteDemo(owner: string, id: string): Promise<boolean> {
  const { count } = await getPrisma().inlineDemo.deleteMany({ where: { id, owner } });
  return count > 0;
}

export async function bump(owner: string, id: string, field: 'clicks' | 'plays'): Promise<boolean> {
  const { count } = await getPrisma().inlineDemo.updateMany({
    where: { id, owner },
    data: { [field]: { increment: 1 } },
  });
  return count > 0;
}

// ---- slots ----

export async function getSlots(owner: string): Promise<Record<string, string>> {
  const rows = await getPrisma().inlineDemoSlot.findMany({ where: { owner } });
  return Object.fromEntries(rows.map((r) => [r.name, r.demoId]));
}

export async function resolveSlot(owner: string, name: string): Promise<Demo | null> {
  const slot = await getPrisma().inlineDemoSlot.findUnique({
    where: { owner_name: { owner, name } },
    select: { demo: { select: DEMO_FIELDS } },
  });
  return slot ? toDemo(slot.demo) : null;
}

/** Points the slot at one of the owner's demos; false if the demo isn't theirs or doesn't exist. */
export async function setSlot(owner: string, name: string, demoId: string): Promise<boolean> {
  const db = getPrisma();
  const demo = await db.inlineDemo.findFirst({ where: { id: demoId, owner }, select: { id: true } });
  if (!demo) return false;
  await db.inlineDemoSlot.upsert({
    where: { owner_name: { owner, name } },
    create: { owner, name, demoId },
    update: { demoId },
  });
  return true;
}

// ---- managed short link ----

export async function getShortLink(owner: string): Promise<{ code?: string; shortUrl?: string }> {
  const row = await getPrisma().inlineDemoShortLink.findUnique({ where: { owner } });
  return row ? { code: row.code, shortUrl: row.shortUrl } : {};
}

export async function setShortLink(owner: string, code: string, shortUrl: string): Promise<void> {
  await getPrisma().inlineDemoShortLink.upsert({
    where: { owner },
    create: { owner, code, shortUrl },
    update: { code, shortUrl },
  });
}

// ---- assets ----

export const MAX_ASSET_BYTES = 50 * 1024 * 1024;

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Type by extension, so <video>/<img> always get a type they can play or render. */
export function contentTypeFor(name: string): string {
  return TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

/** Unique public name: timestamp + random + sanitized original filename. */
export function assetName(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'upload';
  return `${Date.now().toString(36)}${randomBytes(3).toString('hex')}-${base}`;
}

export async function storeAsset(owner: string, filename: string, bytes: Uint8Array, contentType: string): Promise<string> {
  if (!contentType || contentType === 'application/octet-stream') contentType = contentTypeFor(filename);
  const name = assetName(filename);
  await getPrisma().inlineDemoAsset.create({
    data: { name, owner, contentType, size: bytes.length, bytes: Buffer.from(bytes), created: BigInt(Date.now()) },
  });
  return name;
}

export async function getAsset(name: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const row = await getPrisma().inlineDemoAsset.findUnique({ where: { name } });
  if (!row) return null;
  const contentType =
    !row.contentType || row.contentType === 'application/octet-stream' ? contentTypeFor(name) : row.contentType;
  return { bytes: Buffer.from(row.bytes), contentType };
}
