import { NextRequest, NextResponse } from 'next/server';
import { generateMemorable, isValidBase62 } from '@/lib/base62';
import { createLink, codeExists } from '@/lib/storage';

const MAX_RETRIES = 5;
const BASE_URL = process.env.BASE_URL || 'https://0-2.ca';

async function findAvailableCode(customCode?: string): Promise<string> {
  if (customCode) {
    if (!isValidBase62(customCode)) {
      throw new Error('Invalid custom code');
    }
    if (await codeExists(customCode)) {
      throw new Error('Code already taken');
    }
    return customCode;
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateMemorable();
    if (!(await codeExists(code))) {
      return code;
    }
  }

  throw new Error('Unable to generate unique code');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, customCode, fingerprint, pin } = body;

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

    const shortCode = await findAvailableCode(customCode);
    await createLink(shortCode, url, fingerprint, pin);

    return NextResponse.json({
      shortCode,
      shortUrl: `${BASE_URL}/${shortCode}`,
      qrUrl: `${BASE_URL}/api/qr?code=${shortCode}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
