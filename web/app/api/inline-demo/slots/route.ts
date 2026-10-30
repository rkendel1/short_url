import { NextRequest } from 'next/server';
import { getSlots, guard } from '@/lib/inline-demo';
import { error, json } from '@/lib/http';

export async function GET(request: NextRequest) {
  try {
    const g = await guard(request, '');
    if (!g.ok) return g.response;
    return json({ slots: await getSlots(g.owner) });
  } catch (err) {
    console.error('inline-demo slots failed', err);
    return error(500, 'Failed to list slots');
  }
}
