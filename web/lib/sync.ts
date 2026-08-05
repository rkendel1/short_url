import { getAllLinks, syncFromServer } from './browser-db';

export interface SyncChange {
  type: 'create' | 'update' | 'delete';
  code: string;
  url?: string;
  pin?: string;
}

const SYNC_QUEUE_KEY = 'short_url_sync_queue';

function getSyncQueue(): SyncChange[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(SYNC_QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function setSyncQueue(queue: SyncChange[]): void {
  if (typeof window === 'undefined') return;
  if (queue.length === 0) {
    localStorage.removeItem(SYNC_QUEUE_KEY);
  } else {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }
}

export function queueChange(change: SyncChange): void {
  const queue = getSyncQueue();
  queue.push(change);
  setSyncQueue(queue);
}

export async function syncChanges(fingerprint: string): Promise<void> {
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  for (const change of queue) {
    try {
      if (change.type === 'create') {
        await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: change.url,
            customCode: change.code,
            fingerprint,
            pin: change.pin,
          }),
        });
      } else if (change.type === 'update') {
        await fetch(`/api/links/${change.code}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: change.url,
            fingerprint,
            pin: change.pin,
          }),
        });
      } else if (change.type === 'delete') {
        await fetch(`/api/links/${change.code}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint }),
        });
      }
    } catch (error) {
      console.error(`Failed to sync change for ${change.code}:`, error);
      return;
    }
  }

  setSyncQueue([]);
}

export async function syncFromServerLinks(fingerprint: string): Promise<void> {
  try {
    const response = await fetch('/api/my-links', {
      headers: { 'x-fingerprint': fingerprint },
    });

    if (!response.ok) return;

    const data = await response.json();
    const links = data.links || [];

    await syncFromServer(links);
  } catch (error) {
    console.error('Failed to sync from server:', error);
  }
}
