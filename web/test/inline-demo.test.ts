import { createHash, sign } from 'node:crypto';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { canonicalRequest } from '@/lib/request-signing';
import { GET as listDemos, POST as createDemo } from '@/app/api/inline-demo/demos/route';
import { DELETE as deleteDemo, GET as getDemo, PATCH as patchDemo } from '@/app/api/inline-demo/demos/[id]/route';
import { POST as bump } from '@/app/api/inline-demo/demos/[id]/bump/route';
import { GET as getSlots } from '@/app/api/inline-demo/slots/route';
import { GET as resolveSlot, PUT as putSlot } from '@/app/api/inline-demo/slots/[name]/route';
import { GET as getShortLink, PUT as putShortLink } from '@/app/api/inline-demo/short-link/route';
import { POST as upload } from '@/app/api/inline-demo/assets/route';
import { GET as getAsset } from '@/app/api/inline-demo/assets/[name]/route';
import { newOwner, plainRequest, randomIp, type Owner } from './helpers';

/** Signs any method, with a JSON or binary body (the signature covers the exact bytes sent). */
function signed(who: Owner, method: string, path: string, body?: Record<string, unknown> | Uint8Array, headers: Record<string, string> = {}) {
  const raw = body === undefined ? '' : body instanceof Uint8Array ? body : JSON.stringify(body);
  const timestamp = String(Date.now());
  const bodyHash = createHash('sha256').update(raw).digest('hex');
  const signature = sign('sha256', Buffer.from(canonicalRequest(method, path, timestamp, bodyHash)), {
    key: who.privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('hex');
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      'content-type': body instanceof Uint8Array ? 'application/octet-stream' : 'application/json',
      'x-forwarded-for': randomIp(),
      'x-owner': who.owner,
      'x-owner-key': who.publicKeyHex,
      'x-owner-timestamp': timestamp,
      'x-owner-signature': signature,
      ...headers,
    },
    body: raw === '' ? undefined : (raw as BodyInit),
  });
}

const id = (value: string) => ({ params: Promise.resolve({ id: value }) });
const slot = (value: string) => ({ params: Promise.resolve({ name: value }) });

async function newDemo(who: Owner, extra: Record<string, unknown> = {}) {
  const res = await createDemo(signed(who, 'POST', '/api/inline-demo/demos', { title: 'Tour', kind: 'video', src: '/uploads/a.mp4', ...extra }));
  expect(res.status).toBe(201);
  return (await res.json()).demo;
}

describe('inline-demo storage', () => {
  it('refuses unsigned requests', async () => {
    expect((await listDemos(plainRequest('GET', '/api/inline-demo/demos'))).status).toBe(401);
  });

  it('creates, lists, updates, counts and deletes demos', async () => {
    const who = newOwner();
    const demo = await newDemo(who, { caption: 'hi' });
    expect(demo).toMatchObject({ title: 'Tour', kind: 'video', caption: 'hi', clicks: 0, plays: 0 });

    const list = await (await listDemos(signed(who, 'GET', '/api/inline-demo/demos'))).json();
    expect(list.demos.map((d: { id: string }) => d.id)).toEqual([demo.id]);

    const patched = await patchDemo(signed(who, 'PATCH', `/api/inline-demo/demos/${demo.id}`, { title: 'New', caption: '' }), id(demo.id));
    const after = (await patched.json()).demo;
    expect(after).toMatchObject({ title: 'New', src: '/uploads/a.mp4' });
    expect(after).not.toHaveProperty('caption');

    await bump(signed(who, 'POST', `/api/inline-demo/demos/${demo.id}/bump`, { field: 'plays' }), id(demo.id));
    const got = await (await getDemo(signed(who, 'GET', `/api/inline-demo/demos/${demo.id}`), id(demo.id))).json();
    expect(got.demo.plays).toBe(1);

    expect((await deleteDemo(signed(who, 'DELETE', `/api/inline-demo/demos/${demo.id}`), id(demo.id))).status).toBe(200);
    expect((await getDemo(signed(who, 'GET', `/api/inline-demo/demos/${demo.id}`), id(demo.id))).status).toBe(404);
  });

  it("keeps each owner's demos private", async () => {
    const alice = newOwner();
    const mallory = newOwner();
    const demo = await newDemo(alice);
    expect((await getDemo(signed(mallory, 'GET', `/api/inline-demo/demos/${demo.id}`), id(demo.id))).status).toBe(404);
    expect((await patchDemo(signed(mallory, 'PATCH', `/api/inline-demo/demos/${demo.id}`, { title: 'x' }), id(demo.id))).status).toBe(404);
    expect((await putSlot(signed(mallory, 'PUT', '/api/inline-demo/slots/signature', { demoId: demo.id }), slot('signature'))).status).toBe(404);
  });

  it('repoints slots and drops them when their demo is deleted', async () => {
    const who = newOwner();
    const first = await newDemo(who);
    const second = await newDemo(who, { title: 'Second' });
    for (const demo of [first, second]) {
      expect((await putSlot(signed(who, 'PUT', '/api/inline-demo/slots/signature', { demoId: demo.id }), slot('signature'))).status).toBe(200);
    }
    const live = await (await resolveSlot(signed(who, 'GET', '/api/inline-demo/slots/signature'), slot('signature'))).json();
    expect(live.demo.id).toBe(second.id);

    await deleteDemo(signed(who, 'DELETE', `/api/inline-demo/demos/${second.id}`), id(second.id));
    const slots = await (await getSlots(signed(who, 'GET', '/api/inline-demo/slots'))).json();
    expect(slots.slots).toEqual({});
  });

  it('remembers the managed short link per owner', async () => {
    const who = newOwner();
    expect(await (await getShortLink(signed(who, 'GET', '/api/inline-demo/short-link'))).json()).toEqual({});
    await putShortLink(signed(who, 'PUT', '/api/inline-demo/short-link', { code: 'otter0427', shortUrl: 'https://0-2.ca/otter0427' }));
    expect(await (await getShortLink(signed(who, 'GET', '/api/inline-demo/short-link'))).json()).toEqual({
      code: 'otter0427',
      shortUrl: 'https://0-2.ca/otter0427',
    });
  });

  it('stores uploads and serves them publicly with range support', async () => {
    const who = newOwner();
    const bytes = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
    const res = await upload(signed(who, 'POST', '/api/inline-demo/assets', bytes, { 'x-filename': 'clip.mp4' }));
    expect(res.status).toBe(201);
    const { name } = await res.json();
    expect(name).toMatch(/-clip\.mp4$/);

    const full = await getAsset(plainRequest('GET', `/api/inline-demo/assets/${name}`), slot(name));
    expect(full.headers.get('content-type')).toBe('video/mp4');
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(bytes);

    const part = await getAsset(plainRequest('GET', `/api/inline-demo/assets/${name}`, { headers: { range: 'bytes=10-19' } }), slot(name));
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe('bytes 10-19/100');
    expect(Array.from(new Uint8Array(await part.arrayBuffer()))).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('refuses an upload whose bytes differ from the signed ones', async () => {
    const who = newOwner();
    const req = signed(who, 'POST', '/api/inline-demo/assets', new Uint8Array([1, 2, 3]));
    const tampered = new NextRequest(req.url, { method: 'POST', headers: req.headers, body: new Uint8Array([9, 9, 9]) });
    expect((await upload(tampered)).status).toBe(401);
  });
});
