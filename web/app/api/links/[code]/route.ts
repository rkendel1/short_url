import { NextRequest, NextResponse } from 'next/server';
import { updateLinkUrl, getLinkData } from '@/lib/kv';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const data = await getLinkData(code);

    if (!data) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code,
      url: data.url,
      clicks: data.clicks,
      created: data.created,
      updated: data.updated,
      last: data.last,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch link' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await request.json();
    const { url, fingerprint, pin } = body;

    if (!url || !fingerprint) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    const success = await updateLinkUrl(code, url, fingerprint, pin);

    if (!success) {
      return NextResponse.json(
        { error: 'Unauthorized or invalid PIN' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update link' },
      { status: 500 }
    );
  }
}
