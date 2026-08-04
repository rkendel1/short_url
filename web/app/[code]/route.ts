import { NextRequest, NextResponse } from 'next/server';
import { getLink, incrementClicks } from '@/lib/kv';
import { redirect } from 'next/navigation';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;

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
