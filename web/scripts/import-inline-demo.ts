/**
 * Imports inline-demo data (its local-dev .data/demos.json and .data/uploads/) into
 * short_url's database, which is where inline-demo stores everything.
 *
 * Runs on every deploy via scripts/deploy-db.sh, so it is insert-only: rows that
 * already exist are left untouched, so a re-deploy never rolls back demos, slots
 * or counts edited since the first import. Does nothing unless INLINE_DEMO_IMPORT
 * is set.
 *
 *   INLINE_DEMO_IMPORT=path/to/demos.json   (uploads are read from ./uploads beside it)
 *   INLINE_DEMO_OWNER=<inline-demo's SHORT_URL_OWNER>
 *
 * Usage: DATABASE_URL=... INLINE_DEMO_IMPORT=... INLINE_DEMO_OWNER=... npx tsx scripts/import-inline-demo.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { contentTypeFor } from '../lib/inline-demo';

interface ImportedDemo {
  id: string;
  title: string;
  kind: string;
  src: string;
  poster?: string;
  caption?: string;
  clicks?: number;
  plays?: number;
  created?: number;
  updated?: number;
}

interface ImportFile {
  demos?: Record<string, ImportedDemo>;
  slots?: Record<string, string>;
  shortUrl?: { code?: string; shortUrl?: string };
}

async function main() {
  const file = process.env.INLINE_DEMO_IMPORT;
  if (!file) {
    console.log('INLINE_DEMO_IMPORT not set — nothing to import.');
    return;
  }
  if (!existsSync(file)) {
    console.log(`No inline-demo data at ${file} — nothing to import.`);
    return;
  }
  const owner = process.env.INLINE_DEMO_OWNER;
  if (!owner || !/^[A-Za-z0-9_-]{16,128}$/.test(owner)) {
    throw new Error("INLINE_DEMO_OWNER must be set to inline-demo's SHORT_URL_OWNER to import its data");
  }

  const data: ImportFile = JSON.parse(readFileSync(file, 'utf8'));
  const prisma = new PrismaClient();
  try {
    const demos = await prisma.inlineDemo.createMany({
      data: Object.values(data.demos ?? {}).map((d) => ({
        id: d.id,
        owner,
        title: d.title,
        kind: d.kind,
        src: d.src,
        poster: d.poster ?? null,
        caption: d.caption ?? null,
        clicks: d.clicks ?? 0,
        plays: d.plays ?? 0,
        created: BigInt(d.created ?? Date.now()),
        updated: d.updated == null ? null : BigInt(d.updated),
      })),
      skipDuplicates: true,
    });

    // Only slots whose demo exists and belongs to this owner (a slot can't point at another owner's demo).
    const owned = new Set(
      (await prisma.inlineDemo.findMany({ where: { owner }, select: { id: true } })).map((d) => d.id)
    );
    const slots = await prisma.inlineDemoSlot.createMany({
      data: Object.entries(data.slots ?? {})
        .filter(([, demoId]) => owned.has(demoId))
        .map(([name, demoId]) => ({ owner, name, demoId })),
      skipDuplicates: true,
    });

    let shortLinks = 0;
    if (data.shortUrl?.code && data.shortUrl.shortUrl) {
      ({ count: shortLinks } = await prisma.inlineDemoShortLink.createMany({
        data: [{ owner, code: data.shortUrl.code, shortUrl: data.shortUrl.shortUrl }],
        skipDuplicates: true,
      }));
    }

    // Assets keep their names, so demo URLs (/uploads/<name>) keep working.
    let assets = 0;
    const uploads = path.join(path.dirname(file), 'uploads');
    if (existsSync(uploads)) {
      for (const name of readdirSync(uploads)) {
        const full = path.join(uploads, name);
        if (name.startsWith('.') || !statSync(full).isFile()) continue;
        const bytes = readFileSync(full);
        const { count } = await prisma.inlineDemoAsset.createMany({
          data: [{ name, owner, contentType: contentTypeFor(name), size: bytes.length, bytes, created: BigInt(Date.now()) }],
          skipDuplicates: true,
        });
        assets += count;
      }
    }

    console.log(
      `Imported ${demos.count} demo(s), ${slots.count} slot(s), ${shortLinks} short link(s), ${assets} asset(s) from ${file} (existing rows kept).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('inline-demo import failed:', err);
  process.exit(1);
});
