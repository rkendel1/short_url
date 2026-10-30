import { NextRequest, NextResponse } from 'next/server';
import { getAsset } from '@/lib/inline-demo';
import { error } from '@/lib/http';
import { clientIp, consume, LIMITS } from '@/lib/rate-limit';

type Params = { params: Promise<{ name: string }> };

const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Public read with HTTP range support, so <video> can seek. Names are unguessable and never reused. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await consume(`inline-demo:${clientIp(request)}`, LIMITS.inlineDemo);
    if (!limited.ok) return error(429, 'Too many requests');

    const asset = await getAsset((await params).name);
    if (!asset) return error(404, 'Not found');
    const { bytes, contentType } = asset;
    const total = bytes.length;

    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
    if (range && (range[1] || range[2])) {
      let start: number;
      let end: number;
      if (range[1]) {
        start = Number(range[1]);
        end = range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
      } else {
        start = Math.max(total - Number(range[2]), 0); // suffix: last N bytes
        end = total - 1;
      }
      if (start > end || start >= total) {
        return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
      }
      const body = bytes.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(body), {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Content-Length': String(body.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': IMMUTABLE,
        },
      });
    }

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(total),
        'Accept-Ranges': 'bytes',
        'Cache-Control': IMMUTABLE,
      },
    });
  } catch (err) {
    console.error('inline-demo asset failed', err);
    return error(500, 'Failed to fetch asset');
  }
}
