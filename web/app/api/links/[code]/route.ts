import { NextRequest, NextResponse } from 'next/server';
import { updateLinkUrl, getLinkData, deleteLink } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
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
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { fingerprint } = body;

    if (!fingerprint) {
      return NextResponse.json(
        { error: 'Missing fingerprint' },
        { status: 400 }
      );
    }

    const linkData = await getLinkData(code);
    if (!linkData) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    if (linkData.owner !== fingerprint) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await deleteLink(code);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}
