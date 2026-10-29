import { describe, expect, it } from 'vitest';
import { getPrisma } from '@/lib/storage';
import { create, metadata, newOwner, remove, uniqueCode, update, visit } from './helpers';

describe('redirect', () => {
  it('is temporary and uncacheable', async () => {
    const owner = newOwner();
    const code = uniqueCode();
    await create(owner, { url: 'https://example.com/a', customCode: code });

    const response = await visit(code);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/a');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('follows the latest authorized destination on the very next request', async () => {
    const owner = newOwner();
    const code = uniqueCode();
    await create(owner, { url: 'https://example.com/old', customCode: code });
    expect((await visit(code)).headers.get('location')).toBe('https://example.com/old');

    const { response } = await update(owner, code, { url: 'https://example.com/new', revision: 1 });
    expect(response.status).toBe(200);
    expect((await visit(code)).headers.get('location')).toBe('https://example.com/new');
  });

  it('ignores an unauthorized edit', async () => {
    const owner = newOwner();
    const code = uniqueCode();
    await create(owner, { url: 'https://example.com/mine', customCode: code });

    const { response } = await update(newOwner(), code, { url: 'https://evil.example/', revision: 1 });
    expect(response.status).toBe(403);
    expect((await visit(code)).headers.get('location')).toBe('https://example.com/mine');
  });

  it('counts clicks', async () => {
    const owner = newOwner();
    const code = uniqueCode();
    await create(owner, { url: 'https://example.com/count', customCode: code });
    await visit(code);
    await visit(code);
    expect((await metadata(code)).data.clicks).toBe(2);
  });

  it('returns 404 for an unknown code and 410 for a deleted one', async () => {
    expect((await visit(uniqueCode())).status).toBe(404);

    const owner = newOwner();
    const code = uniqueCode();
    await create(owner, { url: 'https://example.com/bye', customCode: code });
    await remove(owner, code, { revision: 1 });
    const response = await visit(code);
    expect(response.status).toBe(410);
    expect(response.headers.get('location')).toBeNull();
    expect((await metadata(code)).response.status).toBe(410);
  });

  it('does not count clicks on a tombstone', async () => {
    const owner = newOwner();
    const code = uniqueCode();
    await create(owner, { url: 'https://example.com/t', customCode: code });
    await remove(owner, code, { revision: 1 });
    await visit(code);
    const row = await getPrisma().link.findUnique({ where: { code } });
    expect(row?.clicks).toBe(0);
  });
});
