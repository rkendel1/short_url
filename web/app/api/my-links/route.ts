import { NextRequest, NextResponse } from 'next/server';
import { getUserLinks, getLinkData } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const fingerprint = request.headers.get('x-fingerprint');

    if (!fingerprint) {
      return NextResponse.json(
        { error: 'Missing fingerprint' },
        { status: 400 }
      );
    }

    // Use timeout to prevent hanging on KV queries
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 10000)
    );

    try {
      const codes = await Promise.race([
        getUserLinks(fingerprint),
        timeoutPromise,
      ]) as string[];

      if (codes.length === 0) {
        return NextResponse.json({ links: [] });
      }

      const links = await Promise.all(
        codes.map(async (code) => {
          try {
            const data = await Promise.race([
              getLinkData(code),
              timeoutPromise,
            ]);
            if (!data) return null;
            return {
              code,
              url: data.url,
              clicks: data.clicks,
              created: data.created,
              updated: data.updated,
              last: data.last,
            };
          } catch {
            return null;
          }
        })
      );

      return NextResponse.json({
        links: links.filter((link) => link !== null),
      });
    } catch (timeoutError) {
      // Return empty on timeout instead of hanging
      return NextResponse.json({ links: [] });
    }
  } catch (error) {
    // Return empty on error instead of 500
    return NextResponse.json({ links: [] });
  }
}
