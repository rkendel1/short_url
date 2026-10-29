import { NextRequest } from 'next/server';
import { getUserLinks } from '@/lib/storage';
import { clientIp, consume, LIMITS } from '@/lib/rate-limit';
import { error, json, tooManyRequests } from '@/lib/http';

export async function GET(request: NextRequest) {
  try {
    const limited = await consume(`read:${clientIp(request)}`, LIMITS.read);
    if (!limited.ok) return tooManyRequests(limited.retryAfter);

    const fingerprint = request.headers.get('x-fingerprint');
    if (!fingerprint) {
      return error(400, 'Missing fingerprint');
    }

    const links = await getUserLinks(fingerprint);
    return json({
      links: links.map((link) => ({
        code: link.code,
        url: link.url,
        clicks: link.clicks,
        created: link.created,
        updated: link.updated,
        last: link.last,
        revision: link.revision,
        protected: link.hasPin,
      })),
    });
  } catch (err) {
    console.error('list links failed', err);
    return error(503, 'Failed to list links');
  }
}
