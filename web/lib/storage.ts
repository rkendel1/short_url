import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export interface LinkData {
  code: string;
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
  const prisma = getPrisma();
  const now = Math.floor(Date.now() / 1000);
  await prisma.link.create({
    data: {
      code,
      url,
      clicks: 0,
      created: now,
      owner: fingerprint,
      pin: pin || null,
    },
  });
}

export async function getLink(code: string): Promise<string | null> {
  const prisma = getPrisma();
  const link = await prisma.link.findUnique({
    where: { code },
    select: { url: true },
  });
  return link?.url || null;
}

export async function incrementClicks(code: string): Promise<void> {
  const prisma = getPrisma();
  const now = Math.floor(Date.now() / 1000);
  await prisma.link.update({
    where: { code },
    data: {
      clicks: { increment: 1 },
      last: now,
    },
  });
}

export async function getLinkData(code: string): Promise<LinkData | null> {
  const prisma = getPrisma();
  const link = await prisma.link.findUnique({
    where: { code },
  });
  if (!link) return null;
  return {
    code: link.code,
    url: link.url,
    clicks: link.clicks,
    created: link.created,
    updated: link.updated || undefined,
    last: link.last || undefined,
    owner: link.owner,
  };
}

export async function updateLinkUrl(
  code: string,
  newUrl: string,
  fingerprint: string,
  pin?: string
): Promise<boolean> {
  const prisma = getPrisma();
  const link = await prisma.link.findUnique({
    where: { code },
    select: { owner: true, pin: true },
  });

  if (!link || link.owner !== fingerprint) return false;
  if (link.pin && pin !== link.pin) return false;

  const now = Math.floor(Date.now() / 1000);
  await prisma.link.update({
    where: { code },
    data: {
      url: newUrl,
      updated: now,
    },
  });

  return true;
}

export async function getUserLinks(fingerprint: string): Promise<string[]> {
  const prisma = getPrisma();
  const links = await prisma.link.findMany({
    where: { owner: fingerprint },
    select: { code: true },
  });
  return links.map(l => l.code);
}

export async function codeExists(code: string): Promise<boolean> {
  const prisma = getPrisma();
  const link = await prisma.link.findUnique({
    where: { code },
    select: { code: true },
  });
  return !!link;
}

export async function deleteLink(code: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.link.delete({
    where: { code },
  });
}
