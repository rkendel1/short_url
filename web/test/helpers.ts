import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import { canonicalRequest } from '@/lib/request-signing';
import { POST as shorten } from '@/app/api/shorten/route';
import { DELETE as deleteLink, GET as getLink, PATCH as patchLink } from '@/app/api/links/[code]/route';
import { GET as follow } from '@/app/[code]/route';

export interface Owner {
  owner: string;
  privateKey: KeyObject;
  publicKeyHex: string;
}

export function newOwner(owner = randomBytes(16).toString('hex')): Owner {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    owner,
    privateKey,
    publicKeyHex: publicKey.export({ format: 'der', type: 'spki' }).toString('hex'),
  };
}

export function uniqueCode(prefix = 'T'): string {
  return prefix + randomBytes(6).toString('hex');
}

/** A distinct client IP per request unless one is given, so tests don't share rate-limit windows. */
export function randomIp(): string {
  return `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
}

interface SignOptions {
  ip?: string;
  timestamp?: number;
  /** Body actually sent, when it should differ from the signed one. */
  sentBody?: string;
  signer?: Owner;
}

export function signedRequest(
  who: Owner,
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: Record<string, unknown>,
  options: SignOptions = {}
): NextRequest {
  const raw = JSON.stringify(body);
  const timestamp = String(options.timestamp ?? Date.now());
  const bodyHash = createHash('sha256').update(raw).digest('hex');
  const signer = options.signer ?? who;
  const signature = sign(
    'sha256',
    Buffer.from(canonicalRequest(method, path, timestamp, bodyHash)),
    { key: signer.privateKey, dsaEncoding: 'ieee-p1363' }
  ).toString('hex');
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': options.ip ?? randomIp(),
      'x-owner': who.owner,
      'x-owner-key': signer.publicKeyHex,
      'x-owner-timestamp': timestamp,
      'x-owner-signature': signature,
    },
    body: options.sentBody ?? raw,
  });
}

export function plainRequest(
  method: string,
  path: string,
  options: { body?: unknown; ip?: string; headers?: Record<string, string> } = {}
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': options.ip ?? randomIp(), ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export function params(code: string) {
  return { params: Promise.resolve({ code }) };
}


export async function create(who: Owner, body: Record<string, unknown>, options: SignOptions = {}) {
  const response = await shorten(signedRequest(who, 'POST', '/api/shorten', body, options));
  return { response, data: await response.json() };
}

export async function update(who: Owner, code: string, body: Record<string, unknown>, options: SignOptions = {}) {
  const response = await patchLink(signedRequest(who, 'PATCH', `/api/links/${code}`, body, options), params(code));
  return { response, data: await response.json() };
}

export async function remove(who: Owner, code: string, body: Record<string, unknown>, options: SignOptions = {}) {
  const response = await deleteLink(signedRequest(who, 'DELETE', `/api/links/${code}`, body, options), params(code));
  return { response, data: await response.json() };
}

export async function metadata(code: string) {
  const response = await getLink(plainRequest('GET', `/api/links/${code}`), params(code));
  return { response, data: await response.json() };
}

export function visit(code: string) {
  return follow(plainRequest('GET', `/${code}`), params(code));
}


/** Pins Date.now() just after the start of a 15-minute boundary so fixed rate-limit windows can't roll over mid-test. */
export function freezeTimeAtWindowStart() {
  const quarterHour = 15 * 60 * 1000;
  const start = Math.floor(Date.now() / quarterHour) * quarterHour + 1000;
  return vi.spyOn(Date, 'now').mockReturnValue(start);
}
