import { NextRequest, NextResponse } from 'next/server';
import { resolveForRedirect } from '@/lib/storage';
import { error } from '@/lib/http';
import { isRedirectable } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    if (code.length > 100) {
      return error(404, 'Short link not found');
    }

    const target = await resolveForRedirect(code);
    if (target.status === 'missing') {
      return error(404, 'Short link not found');
    }
    if (target.status === 'gone') {
      return error(410, 'Short link has been deleted');
    }
    if (!isRedirectable(target.url)) {
      // Rows created before destinations were restricted to http(s).
      return error(403, 'Destination is not an http(s) URL');
    }

    // Temporary and uncached, so an edited destination takes effect on the next request.
    const response = NextResponse.redirect(target.url, { status: 307 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (err) {
    console.error('redirect failed', err);
    return error(503, 'Service unavailable');
  }
}
