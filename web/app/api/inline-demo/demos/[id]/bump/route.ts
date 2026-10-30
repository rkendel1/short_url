import { NextRequest } from 'next/server';
import { bump, guard } from '@/lib/inline-demo';
import { error, json, readJsonBody } from '@/lib/http';

type Params = { params: Promise<{ id: string }> };

/** POST { field: 'clicks' | 'plays' } — counts one signature click or demo play. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return error(400, 'Request body must be a JSON object');
    const g = await guard(request, parsed.raw);
    if (!g.ok) return g.response;

    const { field } = parsed.body;
    if (field !== 'clicks' && field !== 'plays') return error(400, "field must be 'clicks' or 'plays'");
    return (await bump(g.owner, (await params).id, field)) ? json({ success: true }) : error(404, 'Demo not found');
  } catch (err) {
    console.error('inline-demo bump failed', err);
    return error(500, 'Failed to count');
  }
}
