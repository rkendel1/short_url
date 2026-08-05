import { PGlite } from '@electric-sql/pglite';

export interface LinkData {
  code: string;
  url: string;
  clicks: number;
  created: number;
  updated?: number;
  last?: number;
  owner: string;
}

let db: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (!db) {
    db = new PGlite();
    await initializeSchema();
  }
  return db;
}

async function initializeSchema() {
  if (!db) return;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      code VARCHAR(20) PRIMARY KEY,
      url TEXT NOT NULL,
      clicks INTEGER DEFAULT 0,
      created INTEGER NOT NULL,
      updated INTEGER,
      last INTEGER,
      owner VARCHAR(32) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_links (
      fingerprint VARCHAR(32) NOT NULL,
      code VARCHAR(20) NOT NULL,
      PRIMARY KEY (fingerprint, code),
      FOREIGN KEY (code) REFERENCES links(code) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_owner ON links(owner);
    CREATE INDEX IF NOT EXISTS idx_fingerprint ON user_links(fingerprint);
  `);
}

export async function createLink(
  code: string,
  url: string,
  fingerprint: string,
  pin?: string
): Promise<void> {
  const dbInstance = await getDb();
  const now = Math.floor(Date.now() / 1000);

  await dbInstance.transaction(async (tx) => {
    await tx.exec(
      `INSERT INTO links (code, url, clicks, created, owner)
       VALUES ($1, $2, 0, $3, $4)`,
      [code, url, now, fingerprint]
    );

    await tx.exec(
      `INSERT INTO user_links (fingerprint, code) VALUES ($1, $2)`,
      [fingerprint, code]
    );

    if (pin) {
      await tx.exec(
        `UPDATE links SET pin = $1 WHERE code = $2`,
        [pin, code]
      );
    }
  });
}

export async function getLink(code: string): Promise<string | null> {
  const dbInstance = await getDb();
  const result = await dbInstance.query(
    `SELECT url FROM links WHERE code = $1`,
    [code]
  );
  return result.rows.length > 0 ? result.rows[0].url : null;
}

export async function incrementClicks(code: string): Promise<void> {
  const dbInstance = await getDb();
  const now = Math.floor(Date.now() / 1000);

  await dbInstance.exec(
    `UPDATE links SET clicks = clicks + 1, last = $1 WHERE code = $2`,
    [now, code]
  );
}

export async function getLinkData(code: string): Promise<LinkData | null> {
  const dbInstance = await getDb();
  const result = await dbInstance.query(
    `SELECT code, url, clicks, created, updated, last, owner FROM links WHERE code = $1`,
    [code]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    code: row.code,
    url: row.url,
    clicks: row.clicks || 0,
    created: row.created,
    updated: row.updated || undefined,
    last: row.last || undefined,
    owner: row.owner,
  };
}

export async function updateLinkUrl(
  code: string,
  newUrl: string,
  fingerprint: string,
  pin?: string
): Promise<boolean> {
  const dbInstance = await getDb();

  const linkResult = await dbInstance.query(
    `SELECT owner, pin FROM links WHERE code = $1`,
    [code]
  );

  if (linkResult.rows.length === 0) return false;

  const link = linkResult.rows[0];
  if (link.owner !== fingerprint) return false;
  if (link.pin && pin !== link.pin) return false;

  const now = Math.floor(Date.now() / 1000);
  await dbInstance.exec(
    `UPDATE links SET url = $1, updated = $2 WHERE code = $3`,
    [newUrl, now, code]
  );

  return true;
}

export async function getUserLinks(fingerprint: string): Promise<string[]> {
  const dbInstance = await getDb();
  const result = await dbInstance.query(
    `SELECT code FROM user_links WHERE fingerprint = $1`,
    [fingerprint]
  );
  return result.rows.map((row) => row.code);
}

export async function codeExists(code: string): Promise<boolean> {
  const dbInstance = await getDb();
  const result = await dbInstance.query(
    `SELECT 1 FROM links WHERE code = $1 LIMIT 1`,
    [code]
  );
  return result.rows.length > 0;
}
