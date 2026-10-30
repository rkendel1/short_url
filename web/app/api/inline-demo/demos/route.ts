import { NextRequest } from 'next/server';
import { checkDemoInput, createDemo, guard, listDemos, type DemoInput } from '@/lib/inline-demo';
import { error, json, readJsonBody } from '@/lib/http';

export async function GET(request: NextRequest) {
  try {
    const g = await guard(request, '');
    if (!g.ok) return g.response;
    return json({ demos: await listDemos(g.owner) });
  } catch (err) {
    console.error('inline-demo list failed', err);
    return error(500, 'Failed to list demos');
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return error(400, 'Request body must be a JSON object');
    const g = await guard(request, parsed.raw);
    if (!g.ok) return g.response;

    const input = checkDemoInput(parsed.body, false);
    if (!input.ok) return error(400, input.error);
    return json({ demo: await createDemo(g.owner, input.value as DemoInput) }, 201);
  } catch (err) {
    console.error('inline-demo create failed', err);
    return error(500, 'Failed to create demo');
  }
}
