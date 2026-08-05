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

    const codes = await getUserLinks(fingerprint);

    const links = await Promise.all(
      codes.map(async (code) => {
        const data = await getLinkData(code);
        if (!data) return null;
        return {
          code,
          url: data.url,
          clicks: data.clicks,
          created: data.created,
          updated: data.updated,
          last: data.last,
        };
      })
    );

    return NextResponse.json({
      links: links.filter((link) => link !== null),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch links' },
      { status: 500 }
    );
  }
}
