import { NextRequest } from 'next/server';
import { isValidBase62 } from '@/lib/base62';
import { CodeTakenError, createLink, createLinkWithGeneratedCode } from '@/lib/storage';
import { authenticate } from '@/lib/auth';
import { hashPin } from '@/lib/pin';
import { clientIp, consume, LIMITS } from '@/lib/rate-limit';
import { error, json, readJsonBody, tooManyRequests } from '@/lib/http';
import { checkDestination, parsePin } from '@/lib/validation';

const BASE_URL = process.env.BASE_URL || 'https://0-2.ca';

export async function POST(request: NextRequest) {
  try {
    const limited = await consume(`create:${clientIp(request)}`, LIMITS.create);
    if (!limited.ok) return tooManyRequests(limited.retryAfter);

    const parsed = await readJsonBody(request);
    if (!parsed.ok) return error(400, 'Request body must be a JSON object');
    const auth = await authenticate(request, parsed.raw);
    if (!auth.ok) return error(auth.status, auth.error);

    const { url, customCode, pin } = parsed.body;
    const destination = checkDestination(url);
    if (!destination.ok) return error(400, destination.error);
    const checkedPin = parsePin(pin);
    if (!checkedPin.ok) return error(400, checkedPin.error);
    if (customCode !== undefined && (typeof customCode !== 'string' || !isValidBase62(customCode))) {
      return error(400, 'Custom code must be 1-20 letters or digits');
    }

    const link = {
      url: destination.value,
      owner: auth.owner,
      actor: auth.actor,
      pinHash: checkedPin.value === undefined ? undefined : await hashPin(checkedPin.value),
    };

    let shortCode: string;
    if (customCode !== undefined) {
      shortCode = customCode;
      await createLink(shortCode, link);
    } else {
      shortCode = await createLinkWithGeneratedCode(link);
    }

    return json({
      shortCode,
      shortUrl: `${BASE_URL}/${shortCode}`,
      qrUrl: `${BASE_URL}/api/qr?code=${shortCode}`,
      revision: 1,
    });
  } catch (err) {
    if (err instanceof CodeTakenError) return error(409, err.message);
    console.error('create failed', err);
    return error(500, 'Failed to create link');
  }
}
