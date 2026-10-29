import { NextRequest, NextResponse } from 'next/server';
import {
  getLinkData,
  getMutationTarget,
  tombstoneLink,
  updateDestination,
  type MutationResult,
} from '@/lib/storage';
import { authenticate } from '@/lib/auth';
import { checkPin } from '@/lib/pin-guard';
import { clientIp, consume, LIMITS } from '@/lib/rate-limit';
import { error, json, readJsonBody, tooManyRequests } from '@/lib/http';
import { checkDestination, checkRevision, MAX_PIN_LENGTH } from '@/lib/validation';

type Params = { params: Promise<{ code: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await consume(`read:${clientIp(request)}`, LIMITS.read);
    if (!limited.ok) return tooManyRequests(limited.retryAfter);

    const { code } = await params;
    const data = await getLinkData(code);
    if (!data) return error(404, 'Link not found');
    if (data.deleted !== undefined) return error(410, 'Link has been deleted');

    return json({
      code,
      url: data.url,
      clicks: data.clicks,
      created: data.created,
      updated: data.updated,
      last: data.last,
      revision: data.revision,
    });
  } catch (err) {
    console.error('get link failed', err);
    return error(500, 'Failed to fetch link');
  }
}

type Change = { kind: 'update'; url: string } | { kind: 'delete' };

/** Shared path for PATCH and DELETE: rate limit, signature, owner, PIN, then a revision-checked write. */
async function change(request: NextRequest, { params }: Params, kind: Change['kind']): Promise<NextResponse> {
  const limited = await consume(`mutate:${clientIp(request)}`, LIMITS.mutate);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const { code } = await params;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return error(400, 'Request body must be a JSON object');
  const auth = await authenticate(request, parsed.raw);
  if (!auth.ok) return error(auth.status, auth.error);

  const { url, pin, revision } = parsed.body;
  let requested: Change = { kind: 'delete' };
  if (kind === 'update') {
    const destination = checkDestination(url);
    if (!destination.ok) return error(400, destination.error);
    requested = { kind: 'update', url: destination.value };
  }
  const expected = checkRevision(revision);
  if (!expected.ok) return error('missing' in expected ? 428 : 400, expected.error);
  if (pin !== undefined && (typeof pin !== 'string' || pin.length > MAX_PIN_LENGTH)) {
    return error(400, 'Invalid PIN');
  }

  const target = await getMutationTarget(code);
  if (!target) return error(404, 'Link not found');
  if (target.owner !== auth.owner) return error(403, 'Not authorized to modify this link');
  if (target.deleted !== null) return error(410, 'Link has been deleted');

  const pinCheck = await checkPin(code, target, pin as string | undefined);
  if (!pinCheck.ok) {
    return pinCheck.status === 429 ? tooManyRequests(pinCheck.retryAfter) : error(403, pinCheck.error);
  }

  const mutation = {
    code,
    owner: auth.owner,
    actor: auth.actor,
    expectedRevision: expected.value,
    upgradedPinHash: pinCheck.upgradedPinHash,
  };
  const result: MutationResult =
    requested.kind === 'update'
      ? await updateDestination({ ...mutation, url: requested.url })
      : await tombstoneLink(mutation);

  switch (result.status) {
    case 'ok':
      return json({ success: true, revision: result.revision });
    case 'conflict':
      return error(409, 'Link was changed by another request; reload and retry', {
        currentRevision: result.currentRevision,
      });
    case 'gone':
      return error(410, 'Link has been deleted');
    case 'missing':
      return error(404, 'Link not found');
    case 'forbidden':
      return error(403, 'Not authorized to modify this link');
  }
}

export async function PATCH(request: NextRequest, context: Params) {
  try {
    return await change(request, context, 'update');
  } catch (err) {
    console.error('update failed', err);
    return error(500, 'Failed to update link');
  }
}

export async function DELETE(request: NextRequest, context: Params) {
  try {
    return await change(request, context, 'delete');
  } catch (err) {
    console.error('delete failed', err);
    return error(500, 'Failed to delete link');
  }
}
