export interface LocalLinkData {
  code: string;
  url: string;
  clicks: number;
  created: number;
  updated?: number;
  last?: number;
}

const DB_NAME = 'short_url_db';
const STORE_NAME = 'links';
const DB_VERSION = 1;
const DB_TIMEOUT = 5000;

let db: IDBDatabase | null = null;
let dbInitError: Error | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;
  if (dbInitError) throw dbInitError;

  return new Promise((resolve, reject) => {
    try {
      if (!indexedDB) {
        throw new Error('IndexedDB not available');
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      const timeout = setTimeout(() => {
        dbInitError = new Error('IndexedDB timeout');
        reject(dbInitError);
      }, DB_TIMEOUT);

      request.onerror = () => {
        clearTimeout(timeout);
        dbInitError = request.error || new Error('IndexedDB error');
        reject(dbInitError);
      };

      request.onsuccess = () => {
        clearTimeout(timeout);
        db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'code' });
          store.createIndex('created', 'created', { unique: false });
        }
      };
    } catch (err) {
      dbInitError = err instanceof Error ? err : new Error('Unknown error');
      reject(dbInitError);
    }
  });
}

export async function saveLink(link: LocalLinkData): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(link);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getLink(code: string): Promise<LocalLinkData | null> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(code);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function getAllLinks(): Promise<LocalLinkData[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function updateLink(
  code: string,
  updates: Partial<LocalLinkData>
): Promise<void> {
  const link = await getLink(code);
  if (!link) return;

  const updated = { ...link, ...updates };
  await saveLink(updated);
}

export async function deleteLink(code: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(code);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearAllLinks(): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function syncFromServer(links: LocalLinkData[]): Promise<void> {
  await clearAllLinks();
  for (const link of links) {
    await saveLink(link);
  }
}
