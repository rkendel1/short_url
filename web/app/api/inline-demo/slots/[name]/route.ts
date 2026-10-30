import { NextRequest } from 'next/server';
import { guard, isSlotName, resolveSlot, setSlot } from '@/lib/inline-demo';
import { error, json, readJsonBody } from '@/lib/http';

type Params = { params: Promise<{ name: string }> };

/** The demo the slot currently points at. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const g = await guard(request, '');
    if (!g.ok) return g.response;
    const demo = await resolveSlot(g.owner, (await params).name);
    return demo ? json({ demo }) : error(404, 'Slot is not set');
  } catch (err) {
    console.error('inline-demo resolve slot failed', err);
    return error(500, 'Failed to resolve slot');
  }
}

/** PUT { demoId } — repoints the slot. */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return error(400, 'Request body must be a JSON object');
    const g = await guard(request, parsed.raw);
    if (!g.ok) return g.response;

    const { name } = await params;
    if (!isSlotName(name)) return error(400, 'Slot name must be 1-64 chars [A-Za-z0-9_-]');
    const { demoId } = parsed.body;
    if (typeof demoId !== 'string') return error(400, 'demoId is required');
    return (await setSlot(g.owner, name, demoId)) ? json({ success: true }) : error(404, 'Demo not found');
  } catch (err) {
    console.error('inline-demo set slot failed', err);
    return error(500, 'Failed to set slot');
  }
}
