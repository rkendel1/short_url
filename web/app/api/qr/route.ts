import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { isValidBase62 } from '@/lib/base62';
import { clientIp, consume, LIMITS } from '@/lib/rate-limit';
import { error, json, tooManyRequests } from '@/lib/http';

const BASE_URL = process.env.BASE_URL || 'https://sho.rt';

const MIN_QR_SIZE = 64;
const MAX_QR_SIZE = 1024;
const DEFAULT_QR_SIZE = 256;

export async function GET(request: NextRequest) {
  try {
    const limited = await consume(`qr:${clientIp(request)}`, LIMITS.qr);
    if (!limited.ok) return tooManyRequests(limited.retryAfter);

    const code = request.nextUrl.searchParams.get('code');
    const sizeParam = request.nextUrl.searchParams.get('size');

    if (!code) {
      return error(400, 'Missing code parameter');
    }
    if (!isValidBase62(code)) {
      return error(400, 'Invalid code parameter');
    }

    let size = DEFAULT_QR_SIZE;
    if (sizeParam !== null) {
      if (!/^\d{1,4}$/.test(sizeParam)) {
        return error(400, `size must be an integer between ${MIN_QR_SIZE} and ${MAX_QR_SIZE}`);
      }
      size = Number(sizeParam);
      if (size < MIN_QR_SIZE || size > MAX_QR_SIZE) {
        return error(400, `size must be an integer between ${MIN_QR_SIZE} and ${MAX_QR_SIZE}`);
      }
    }

    const qrUrl = `${BASE_URL}/${code}`;
    const qrImage = await QRCode.toDataURL(qrUrl, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return json({ qrImage });
  } catch (err) {
    console.error('qr failed', err);
    return error(500, 'Failed to generate QR code');
  }
}
