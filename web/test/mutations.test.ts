import { describe, expect, it, vi } from 'vitest';
import { getPrisma } from '@/lib/storage';
import { PATCH as patchLink } from '@/app/api/links/[code]/route';
import { create, freezeTimeAtWindowStart, metadata, newOwner, params, plainRequest, remove, uniqueCode, update, visit } from './helpers';

async function link(url = 'https://example.com/start', extra: Record<string, unknown> = {}) {
  const owner = newOwner();
  const code = uniqueCode();
  const { response } = await create(owner, { url, customCode: code, ...extra });
  expect(response.status).toBe(200);
  return { owner, code };
}

describe('mutation authorization', () => {
  it('refuses unsigned requests, including the old fingerprint-in-body form', async () => {
    const { owner, code } = await link();
    const response = await patchLink(
      plainRequest('PATCH', `/api/links/${code}`, {
        body: { url: 'https://evil.example/', fingerprint: owner.owner, revision: 1 },
      }),
      params(code)
    );
    expect(response.status).toBe(401);
  });

  it('refuses a signature over a different body', async () => {
    const { owner, code } = await link();
    const { response } = await update(
      owner,
      code,
      { url: 'https://example.com/signed', revision: 1 },
      { sentBody: JSON.stringify({ url: 'https://evil.example/', revision: 1 }) }
    );
    expect(response.status).toBe(401);
  });

  it('refuses a stale timestamp', async () => {
    const { owner, code } = await link();
    const { response } = await update(
      owner,
      code,
      { url: 'https://example.com/late', revision: 1 },
      { timestamp: Date.now() - 10 * 60 * 1000 }
    );
    expect(response.status).toBe(401);
  });

  it('refuses another key presenting the owner identifier', async () => {
    const { owner, code } = await link();
    const impostor = newOwner(owner.owner);
    const { response } = await update(impostor, code, { url: 'https://evil.example/', revision: 1 });
    expect(response.status).toBe(403);
    expect((await visit(code)).headers.get('location')).toBe('https://example.com/start');
  });

  it('refuses a validly signed request from a different owner, for update and delete', async () => {
    const { code } = await link();
    const stranger = newOwner();
    expect((await update(stranger, code, { url: 'https://evil.example/', revision: 1 })).response.status).toBe(403);
    expect((await remove(stranger, code, { revision: 1 })).response.status).toBe(403);
    expect((await visit(code)).status).toBe(307);
  });

  it('records the verified key, not the owner identifier, as the actor', async () => {
    const { owner, code } = await link();
    await update(owner, code, { url: 'https://example.com/2', revision: 1 });
    const history = await getPrisma().linkRevision.findMany({ where: { code }, orderBy: { revision: 'asc' } });
    expect(history.map((h) => h.actor.startsWith('key:'))).toEqual([true, true]);
    expect(history.some((h) => h.actor.includes(owner.owner))).toBe(false);
  });
});

describe('PIN', () => {
  it('is required for update and for delete, and is stored only as a scrypt hash', async () => {
    const { owner, code } = await link('https://example.com/p', { pin: 'correct-horse' });
    const row = await getPrisma().link.findUnique({ where: { code } });
    expect(row?.pin).toBeNull();
    expect(row?.pinHash).toMatch(/^scrypt\$15\$8\$1\$/);
    expect(row?.pinHash).not.toContain('correct-horse');

    expect((await update(owner, code, { url: 'https://example.com/q', revision: 1 })).response.status).toBe(403);
    expect((await update(owner, code, { url: 'https://example.com/q', revision: 1, pin: 'wrong' })).response.status).toBe(403);
    expect((await remove(owner, code, { revision: 1 })).response.status).toBe(403);
    expect((await remove(owner, code, { revision: 1, pin: 'wrong' })).response.status).toBe(403);

    expect((await update(owner, code, { url: 'https://example.com/q', revision: 1, pin: 'correct-horse' })).response.status).toBe(200);
    expect((await remove(owner, code, { revision: 2, pin: 'correct-horse' })).response.status).toBe(200);
  });

  it('is never returned by the API', async () => {
    const { code } = await link('https://example.com/p', { pin: 'secret-pin' });
    const { data } = await metadata(code);
    expect(JSON.stringify(data)).not.toMatch(/pin/i);
  });

  it('locks out after 5 failed attempts', async () => {
    freezeTimeAtWindowStart();
    const { owner, code } = await link('https://example.com/p', { pin: 'right-pin' });
    for (let i = 0; i < 5; i++) {
      expect((await update(owner, code, { url: 'https://example.com/x', revision: 1, pin: `bad${i}` })).response.status).toBe(403);
    }
    const { response } = await update(owner, code, { url: 'https://example.com/x', revision: 1, pin: 'right-pin' });
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it('rejects PINs that are too short or too long at creation', async () => {
    const owner = newOwner();
    expect((await create(owner, { url: 'https://example.com/', pin: '123' })).response.status).toBe(400);
    expect((await create(owner, { url: 'https://example.com/', pin: 'x'.repeat(129) })).response.status).toBe(400);
  });
});

describe('deletion', () => {
  it('tombstones the code: 410, no reuse by anyone, history kept', async () => {
    const { owner, code } = await link('https://example.com/gone');
    const { response, data } = await remove(owner, code, { revision: 1 });
    expect(response.status).toBe(200);
    expect(data.revision).toBe(2);

    expect((await visit(code)).status).toBe(410);
    expect((await create(owner, { url: 'https://example.com/again', customCode: code })).response.status).toBe(409);
    expect((await create(newOwner(), { url: 'https://evil.example/', customCode: code })).response.status).toBe(409);
    expect((await update(owner, code, { url: 'https://example.com/back', revision: 2 })).response.status).toBe(410);
    expect((await remove(owner, code, { revision: 2 })).response.status).toBe(410);

    const row = await getPrisma().link.findUnique({ where: { code } });
    expect(row?.deleted).not.toBeNull();
    const history = await getPrisma().linkRevision.findMany({ where: { code }, orderBy: { revision: 'asc' } });
    expect(history.map((h) => [h.action, h.urlBefore, h.urlAfter])).toEqual([
      ['create', null, 'https://example.com/gone'],
      ['delete', 'https://example.com/gone', null],
    ]);
  });

  it('cannot hard-delete a link row even with direct SQL', async () => {
    const { code } = await link();
    await expect(getPrisma().$executeRaw`DELETE FROM "Link" WHERE "code" = ${code}`).rejects.toThrow();
  });
});

describe('history', () => {
  it('records every change with actor, time, previous and new destination, and revision', async () => {
    const { owner, code } = await link('https://example.com/1');
    await update(owner, code, { url: 'https://example.com/2', revision: 1 });
    await update(owner, code, { url: 'https://example.com/3', revision: 2 });

    const history = await getPrisma().linkRevision.findMany({ where: { code }, orderBy: { revision: 'asc' } });
    expect(history.map((h) => [h.revision, h.action, h.urlBefore, h.urlAfter])).toEqual([
      [1, 'create', null, 'https://example.com/1'],
      [2, 'update', 'https://example.com/1', 'https://example.com/2'],
      [3, 'update', 'https://example.com/2', 'https://example.com/3'],
    ]);
    expect(history.every((h) => h.at > 0 && h.actor.length > 0)).toBe(true);
    expect((await metadata(code)).data.revision).toBe(3);
  });

  it('is append-only at the database level', async () => {
    const { code } = await link();
    await expect(getPrisma().$executeRaw`UPDATE "LinkRevision" SET "urlAfter" = 'x' WHERE "code" = ${code}`).rejects.toThrow(/append-only/);
    await expect(getPrisma().$executeRaw`DELETE FROM "LinkRevision" WHERE "code" = ${code}`).rejects.toThrow(/append-only/);
    await expect(getPrisma().$executeRaw`TRUNCATE "LinkRevision"`).rejects.toThrow();
  });
});

describe('optimistic concurrency', () => {
  it('requires the expected revision', async () => {
    const { owner, code } = await link();
    expect((await update(owner, code, { url: 'https://example.com/x' })).response.status).toBe(428);
    expect((await remove(owner, code, {})).response.status).toBe(428);
    expect((await update(owner, code, { url: 'https://example.com/x', revision: '1' })).response.status).toBe(400);
    expect((await update(owner, code, { url: 'https://example.com/x', revision: 0 })).response.status).toBe(400);
  });

  it('refuses a stale revision and reports the current one', async () => {
    const { owner, code } = await link();
    await update(owner, code, { url: 'https://example.com/first', revision: 1 });
    const { response, data } = await update(owner, code, { url: 'https://example.com/stale', revision: 1 });
    expect(response.status).toBe(409);
    expect(data.currentRevision).toBe(2);
    expect((await visit(code)).headers.get('location')).toBe('https://example.com/first');
  });

  it('lets exactly one of many concurrent edits with the same revision win', async () => {
    const { owner, code } = await link();
    const attempts = Array.from({ length: 10 }, (_, i) =>
      update(owner, code, { url: `https://example.com/racer${i}`, revision: 1 })
    );
    const results = await Promise.all(attempts);
    const statuses = results.map((r) => r.response.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);

    const winner = results.findIndex((r) => r.response.status === 200);
    expect((await visit(code)).headers.get('location')).toBe(`https://example.com/racer${winner}`);
    const history = await getPrisma().linkRevision.findMany({ where: { code }, orderBy: { revision: 'asc' } });
    expect(history).toHaveLength(2);
    expect(history[1].urlAfter).toBe(`https://example.com/racer${winner}`);
  });

  it('serializes a concurrent edit and delete', async () => {
    const { owner, code } = await link();
    const [edit, del] = await Promise.all([
      update(owner, code, { url: 'https://example.com/edit', revision: 1 }),
      remove(owner, code, { revision: 1 }),
    ]);
    // Exactly one wins; the loser sees either the new revision (409) or the tombstone (410).
    const statuses = [edit.response.status, del.response.status];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409 || s === 410)).toHaveLength(1);
    const history = await getPrisma().linkRevision.findMany({ where: { code } });
    expect(history).toHaveLength(2);
  });

  it('makes a replayed request harmless', async () => {
    const { owner, code } = await link();
    const timestamp = Date.now();
    const first = await update(owner, code, { url: 'https://example.com/once', revision: 1 }, { timestamp });
    expect(first.response.status).toBe(200);
    const replay = await update(owner, code, { url: 'https://example.com/once', revision: 1 }, { timestamp });
    expect(replay.response.status).toBe(409);
  });
});
