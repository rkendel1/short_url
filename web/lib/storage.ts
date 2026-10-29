import { Prisma, PrismaClient } from '@prisma/client';
import { generateMemorable } from './base62';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export class CodeTakenError extends Error {
  constructor(code: string) {
    super(`Short code "${code}" is already taken`);
  }
}

export interface LinkData {
  code: string;
  url: string;
  clicks: number;
  created: number;
  updated?: number;
  last?: number;
  owner: string;
  revision: number;
  deleted?: number;
  hasPin: boolean;
}

export type RedirectTarget =
  | { status: 'found'; url: string }
  | { status: 'gone' }
  | { status: 'missing' };

/** Counts the click and returns the destination in one statement; tombstones never resolve. */
export async function resolveForRedirect(code: string): Promise<RedirectTarget> {
  const db = getPrisma();
  const rows = await db.$queryRaw<{ url: string }[]>`
    UPDATE "Link" SET "clicks" = "clicks" + 1, "last" = ${now()}
    WHERE "code" = ${code} AND "deleted" IS NULL
    RETURNING "url"`;
  if (rows.length > 0) return { status: 'found', url: rows[0].url };
  const existing = await db.link.findUnique({ where: { code }, select: { deleted: true } });
  return existing ? { status: 'gone' } : { status: 'missing' };
}

export async function getLinkData(code: string): Promise<LinkData | null> {
  const link = await getPrisma().link.findUnique({ where: { code } });
  if (!link) return null;
  return {
    code: link.code,
    url: link.url,
    clicks: link.clicks,
    created: link.created,
    updated: link.updated ?? undefined,
    last: link.last ?? undefined,
    owner: link.owner,
    revision: link.revision,
    deleted: link.deleted ?? undefined,
    hasPin: link.pinHash !== null || link.pin !== null,
  };
}

interface NewLink {
  url: string;
  owner: string;
  actor: string;
  pinHash?: string;
}

/** Creates the link and its first history entry atomically. Never overwrites, never reuses a tombstone. */
export async function createLink(code: string, link: NewLink): Promise<void> {
  const at = now();
  try {
    await getPrisma().$transaction([
      getPrisma().link.create({
        data: {
          code,
          url: link.url,
          clicks: 0,
          created: at,
          owner: link.owner,
          pinHash: link.pinHash ?? null,
          revision: 1,
        },
      }),
      getPrisma().linkRevision.create({
        data: { code, revision: 1, action: 'create', urlBefore: null, urlAfter: link.url, actor: link.actor, at },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CodeTakenError(code);
    }
    throw error;
  }
}

export async function createLinkWithGeneratedCode(
  link: NewLink,
  generate: () => string = generateMemorable,
  attempts = 8
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generate();
    try {
      await createLink(code, link);
      return code;
    } catch (error) {
      if (!(error instanceof CodeTakenError)) throw error;
    }
  }
  throw new Error('Unable to generate a unique code');
}

export interface MutationTarget {
  owner: string;
  revision: number;
  deleted: number | null;
  pinHash: string | null;
  legacyPin: string | null;
}

export async function getMutationTarget(code: string): Promise<MutationTarget | null> {
  const link = await getPrisma().link.findUnique({
    where: { code },
    select: { owner: true, revision: true, deleted: true, pinHash: true, pin: true },
  });
  if (!link) return null;
  return {
    owner: link.owner,
    revision: link.revision,
    deleted: link.deleted,
    pinHash: link.pinHash,
    legacyPin: link.pin,
  };
}

export type MutationResult =
  | { status: 'ok'; revision: number }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'gone' }
  | { status: 'missing' }
  | { status: 'forbidden' };

interface Mutation {
  code: string;
  owner: string;
  actor: string;
  expectedRevision: number;
  /** Replaces a legacy plaintext PIN with its hash in the same transaction. */
  upgradedPinHash?: string;
}

/**
 * Locks the row, checks owner, tombstone and expected revision, then applies
 * the change and appends its history entry in one transaction. A concurrent
 * writer holding the same expected revision gets `conflict`, never a silent overwrite.
 */
async function mutate(
  m: Mutation,
  apply: (current: { url: string }) => { url: string; deleted: number | null; action: 'update' | 'delete'; urlAfter: string | null }
): Promise<MutationResult> {
  return getPrisma().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ url: string; owner: string; revision: number; deleted: number | null }[]>`
      SELECT "url", "owner", "revision", "deleted" FROM "Link" WHERE "code" = ${m.code} FOR UPDATE`;
    if (rows.length === 0) return { status: 'missing' } as const;
    const current = rows[0];
    if (current.owner !== m.owner) return { status: 'forbidden' } as const;
    if (current.deleted !== null) return { status: 'gone' } as const;
    if (current.revision !== m.expectedRevision) {
      return { status: 'conflict', currentRevision: current.revision } as const;
    }

    const next = apply(current);
    const revision = current.revision + 1;
    const at = now();
    await tx.link.update({
      where: { code: m.code },
      data: {
        url: next.url,
        deleted: next.deleted,
        revision,
        updated: at,
        ...(m.upgradedPinHash ? { pinHash: m.upgradedPinHash, pin: null } : {}),
      },
    });
    await tx.linkRevision.create({
      data: {
        code: m.code,
        revision,
        action: next.action,
        urlBefore: current.url,
        urlAfter: next.urlAfter,
        actor: m.actor,
        at,
      },
    });
    return { status: 'ok', revision } as const;
  });
}

export function updateDestination(m: Mutation & { url: string }): Promise<MutationResult> {
  return mutate(m, () => ({ url: m.url, deleted: null, action: 'update', urlAfter: m.url }));
}

/** Deletion keeps the row as a tombstone so the code can never be claimed again. */
export function tombstoneLink(m: Mutation): Promise<MutationResult> {
  return mutate(m, (current) => ({ url: current.url, deleted: now(), action: 'delete', urlAfter: null }));
}

export async function getUserLinks(owner: string): Promise<LinkData[]> {
  const links = await getPrisma().link.findMany({
    where: { owner, deleted: null },
    orderBy: { created: 'desc' },
  });
  return links.map((link) => ({
    code: link.code,
    url: link.url,
    clicks: link.clicks,
    created: link.created,
    updated: link.updated ?? undefined,
    last: link.last ?? undefined,
    owner: link.owner,
    revision: link.revision,
    hasPin: link.pinHash !== null || link.pin !== null,
  }));
}

/**
 * Binds `owner` to `publicKey` on first use and reports whether the stored
 * binding matches. Race-safe: concurrent first uses converge on one key.
 */
export async function bindOwnerKey(owner: string, publicKey: string, keyId: string): Promise<boolean> {
  const db = getPrisma();
  await db.$executeRaw`
    INSERT INTO "OwnerKey" ("owner", "publicKey", "keyId", "created")
    VALUES (${owner}, ${publicKey}, ${keyId}, ${now()})
    ON CONFLICT ("owner") DO NOTHING`;
  const bound = await db.ownerKey.findUnique({ where: { owner }, select: { publicKey: true } });
  return bound?.publicKey === publicKey;
}
