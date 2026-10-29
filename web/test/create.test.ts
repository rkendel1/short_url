import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST as shorten } from '@/app/api/shorten/route';
import { canonicalRequest } from '@/lib/request-signing';
import { createLink, createLinkWithGeneratedCode, getPrisma } from '@/lib/storage';
import { generateMemorable } from '@/lib/base62';
import { create, newOwner, plainRequest, randomIp, uniqueCode, visit } from './helpers';

describe('code collisions', () => {
  it('refuses a taken custom code without touching the existing link', async () => {
    const first = newOwner();
    const code = uniqueCode();
    expect((await create(first, { url: 'https://example.com/original', customCode: code })).response.status).toBe(200);

    for (const who of [first, newOwner()]) {
      const { response, data } = await create(who, { url: 'https://evil.example/', customCode: code });
      expect(response.status).toBe(409);
      expect(data.error).not.toMatch(/prisma|unique constraint/i);
    }
    expect((await visit(code)).headers.get('location')).toBe('https://example.com/original');
    expect(await getPrisma().linkRevision.count({ where: { code } })).toBe(1);
  });

  it('lets exactly one of several concurrent creates of the same code win', async () => {
    const code = uniqueCode();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => create(newOwner(), { url: `https://example.com/c${i}`, customCode: code }))
    );
    const statuses = results.map((r) => r.response.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409]);
  });

  it('retries generated codes that collide', async () => {
    const owner = newOwner();
    const taken = uniqueCode('G');
    await createLink(taken, { url: 'https://example.com/taken', owner: owner.owner, actor: 'test' });
    const fresh = uniqueCode('G');
    const sequence = [taken, taken, fresh];
    const code = await createLinkWithGeneratedCode(
      { url: 'https://example.com/new', owner: owner.owner, actor: 'test' },
      () => sequence.shift()!
    );
    expect(code).toBe(fresh);
    expect((await visit(taken)).headers.get('location')).toBe('https://example.com/taken');
  });

  it('generates a code when none is given', async () => {
    const { response, data } = await create(newOwner(), { url: 'https://example.com/auto' });
    expect(response.status).toBe(200);
    expect(data.shortCode).toMatch(/^[a-z]+\d{4}$/);
    expect(data.revision).toBe(1);
  });

  it('generates memorable codes from a CSPRNG', () => {
    const codes = new Set(Array.from({ length: 200 }, generateMemorable));
    expect(codes.size).toBeGreaterThan(190);
  });
});

describe('input validation', () => {
  const owner = newOwner();

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com/x',
    'mailto:a@example.com',
    'https://user:pass@example.com/',
    'not a url',
    '/relative/path',
    '',
    `https://example.com/${'a'.repeat(2048)}`,
  ])('rejects destination %s', async (url) => {
    const { response } = await create(owner, { url });
    expect(response.status).toBe(400);
  });

  it('rejects a non-string destination', async () => {
    expect((await create(owner, { url: 42 })).response.status).toBe(400);
  });

  it('applies the same rules to edits', async () => {
    const code = uniqueCode();
    await create(owner, { url: 'https://example.com/ok', customCode: code });
    const { response } = await import('./helpers').then((h) =>
      h.update(owner, code, { url: 'javascript:alert(1)', revision: 1 })
    );
    expect(response.status).toBe(400);
  });

  it('accepts http and https', async () => {
    expect((await create(owner, { url: 'http://example.com/plain' })).response.status).toBe(200);
    expect((await create(owner, { url: 'https://example.com/secure?q=1#frag' })).response.status).toBe(200);
  });

  it.each(['has-hyphen', 'has space', 'x'.repeat(21), 'ünï'])('rejects custom code %s', async (customCode) => {
    expect((await create(owner, { url: 'https://example.com/', customCode })).response.status).toBe(400);
  });

  it('rejects a body that is not a JSON object', async () => {
    const response = await shorten(plainRequest('POST', '/api/shorten', { body: ['https://example.com/'] }));
    expect(response.status).toBe(400);
  });
});

describe('browser compatibility', () => {
  it('accepts a request signed with WebCrypto, as the browser does', async () => {
    const subtle = webcrypto.subtle;
    const keys = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const spki = Buffer.from(await subtle.exportKey('spki', keys.publicKey)).toString('hex');
    const raw = JSON.stringify({ url: 'https://example.com/browser' });
    const bodyHash = Buffer.from(await subtle.digest('SHA-256', new TextEncoder().encode(raw))).toString('hex');
    const timestamp = String(Date.now());
    const signature = Buffer.from(
      await subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keys.privateKey,
        new TextEncoder().encode(canonicalRequest('POST', '/api/shorten', timestamp, bodyHash))
      )
    ).toString('hex');

    const response = await shorten(
      new NextRequest('http://localhost/api/shorten', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': randomIp(),
          'x-owner': 'browser0123456789abcdef0123456789',
          'x-owner-key': spki,
          'x-owner-timestamp': timestamp,
          'x-owner-signature': signature,
        },
        body: raw,
      })
    );
    expect(response.status).toBe(200);
  });
});
