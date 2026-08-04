import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

const BASE_URL = process.env.BASE_URL || 'https://sho.rt';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const size = request.nextUrl.searchParams.get('size') || '256';

    if (!code) {
      return NextResponse.json(
        { error: 'Missing code parameter' },
        { status: 400 }
      );
    }

    const qrUrl = `${BASE_URL}/${code}`;
    const qrImage = await QRCode.toDataURL(qrUrl, {
      width: parseInt(size),
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return NextResponse.json({ qrImage });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}
