import { NextRequest } from 'next/server';
import { guard, MAX_ASSET_BYTES, storeAsset } from '@/lib/inline-demo';
import { error, json } from '@/lib/http';

/**
 * Raw upload: the body is the file's bytes (and what the signature covers),
 * Content-Type is its type and X-Filename its original name. Returns { name };
 * the asset is then public at /api/inline-demo/assets/<name>.
 */
export async function POST(request: NextRequest) {
  try {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_ASSET_BYTES) return error(413, 'File too large');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length === 0) return error(400, 'Empty upload');
    if (bytes.length > MAX_ASSET_BYTES) return error(413, 'File too large');

    const g = await guard(request, bytes);
    if (!g.ok) return g.response;

    const filename = request.headers.get('x-filename') || 'upload';
    const contentType = request.headers.get('content-type') || '';
    return json({ name: await storeAsset(g.owner, filename, bytes, contentType) }, 201);
  } catch (err) {
    console.error('inline-demo upload failed', err);
    return error(500, 'Failed to store upload');
  }
}
