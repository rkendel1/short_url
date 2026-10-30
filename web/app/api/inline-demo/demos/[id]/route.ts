import { NextRequest } from 'next/server';
import { checkDemoInput, deleteDemo, getDemo, guard, updateDemo } from '@/lib/inline-demo';
import { error, json, readJsonBody } from '@/lib/http';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const g = await guard(request, '');
    if (!g.ok) return g.response;
    const demo = await getDemo(g.owner, (await params).id);
    return demo ? json({ demo }) : error(404, 'Demo not found');
  } catch (err) {
    console.error('inline-demo get failed', err);
    return error(500, 'Failed to fetch demo');
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return error(400, 'Request body must be a JSON object');
    const g = await guard(request, parsed.raw);
    if (!g.ok) return g.response;

    const patch = checkDemoInput(parsed.body, true);
    if (!patch.ok) return error(400, patch.error);
    const demo = await updateDemo(g.owner, (await params).id, patch.value);
    return demo ? json({ demo }) : error(404, 'Demo not found');
  } catch (err) {
    console.error('inline-demo update failed', err);
    return error(500, 'Failed to update demo');
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return error(400, 'Request body must be a JSON object');
    const g = await guard(request, parsed.raw);
    if (!g.ok) return g.response;
    return (await deleteDemo(g.owner, (await params).id)) ? json({ success: true }) : error(404, 'Demo not found');
  } catch (err) {
    console.error('inline-demo delete failed', err);
    return error(500, 'Failed to delete demo');
  }
}
