import { NextRequest } from 'next/server';
import { getShortLink, guard, setShortLink } from '@/lib/inline-demo';
import { error, json, readJsonBody } from '@/lib/http';
import { checkDestination } from '@/lib/validation';

/** The short_url link inline-demo manages for this owner ({} until the first "Make live"). */
export async function GET(request: NextRequest) {
  try {
    const g = await guard(request, '');
    if (!g.ok) return g.response;
    return json(await getShortLink(g.owner));
  } catch (err) {
    console.error('inline-demo get short link failed', err);
    return error(500, 'Failed to fetch short link');
  }
}

/** PUT { code, shortUrl } */
export async function PUT(request: NextRequest) {
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return error(400, 'Request body must be a JSON object');
    const g = await guard(request, parsed.raw);
    if (!g.ok) return g.response;

    const { code, shortUrl } = parsed.body;
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(code)) return error(400, 'Invalid code');
    const url = checkDestination(shortUrl);
    if (!url.ok) return error(400, `shortUrl: ${url.error}`);
    await setShortLink(g.owner, code, url.value);
    return json({ success: true });
  } catch (err) {
    console.error('inline-demo set short link failed', err);
    return error(500, 'Failed to save short link');
  }
}
