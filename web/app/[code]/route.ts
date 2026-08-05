import { NextRequest, NextResponse } from 'next/server';
import { getLink, incrementClicks } from '@/lib/db';
import { redirect } from 'next/navigation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const url = await getLink(code);

  if (!url) {
    return NextResponse.json(
      { error: 'Short link not found' },
      { status: 404 }
    );
  }

  await incrementClicks(code);

  return NextResponse.redirect(url, { status: 301 });
}
