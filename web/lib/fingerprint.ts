/**
 * Cryptographic Identity System
 * 
 * Security Model:
 * This implements a secure, account-free identity system using:
 * 1. A 256-bit cryptographically secure seed (generated on first visit)
 * 2. An ECDSA key pair for signing challenges
 * 3. Device fingerprinting for additional binding
 * 4. Identity = SHA256(seed + fingerprint + publicKey)
 * 
 * Security Properties:
 * - Cryptographically unique (256-bit seed + ECDSA key)
 * - Verifiable (challenge-response signing)
 * - Device-bound (fingerprint component)
 * - Tamper-evident (signature verification)
 * - No server-side secrets needed
 * 
 * If localStorage/IndexedDB is cleared, a new identity is created.
 * For link recovery, users should set a PIN on important links.
 */

// Storage keys
const STORAGE_KEYS = {
  SEED: 'identity_seed',
  PUBLIC_KEY: 'identity_pubkey',
  IDENTITY: 'fp', // Keep 'fp' for backwards compatibility
} as const;

// IndexedDB for storing the private key (more secure than localStorage)
const DB_NAME = 'short_url_identity';
const DB_VERSION = 1;
const KEY_STORE = 'keys';

/**
 * Opens or creates the IndexedDB database for key storage
 */
function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(new Error('Failed to open key database'));
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE);
      }
    };
  });
}

/**
 * Stores the private key in IndexedDB
 */
async function storePrivateKey(key: CryptoKey): Promise<void> {
  const db = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE, 'readwrite');
    const store = transaction.objectStore(KEY_STORE);
    const request = store.put(key, 'privateKey');
    
    request.onerror = () => reject(new Error('Failed to store private key'));
    request.onsuccess = () => resolve();
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Retrieves the private key from IndexedDB
 */
async function getPrivateKey(): Promise<CryptoKey | null> {
  try {
    const db = await openKeyDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(KEY_STORE, 'readonly');
      const store = transaction.objectStore(KEY_STORE);
      const request = store.get('privateKey');
      
      request.onerror = () => reject(new Error('Failed to retrieve private key'));
      request.onsuccess = () => resolve(request.result || null);
      
      transaction.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Generates a 256-bit cryptographically secure seed
 */
function generateSeed(): string {
  const array = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates an ECDSA key pair using WebCrypto
 */
async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false, // Private key not extractable (more secure)
    ['sign', 'verify']
  );
}

/**
 * Exports the public key to a storable format
 */
async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', key);
  const bytes = new Uint8Array(exported);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Imports a public key from stored format
 */
async function importPublicKey(hexKey: string): Promise<CryptoKey> {
  const bytes = new Uint8Array(
    hexKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  return await crypto.subtle.importKey(
    'spki',
    bytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  );
}

/**
 * Signs a challenge using the private key
 */
export async function signChallenge(challenge: string): Promise<string | null> {
  try {
    const privateKey = await getPrivateKey();
    if (!privateKey) return null;
    
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(challenge)
    );
    
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('Failed to sign challenge:', error);
    return null;
  }
}

/**
 * Verifies a signature using the stored public key
 */
export async function verifySignature(
  challenge: string,
  signature: string
): Promise<boolean> {
  try {
    const publicKeyHex = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    if (!publicKeyHex) return false;
    
    const publicKey = await importPublicKey(publicKeyHex);
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      signatureBytes,
      new TextEncoder().encode(challenge)
    );
  } catch (error) {
    console.error('Failed to verify signature:', error);
    return false;
  }
}

/**
 * Generates a random challenge for authentication
 */
export function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes a string using SHA-256
 */
async function hashString(str: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// Device Fingerprinting Components
// ============================================================================

/**
 * Generates a canvas fingerprint by drawing text and shapes
 */
async function getCanvasFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    canvas.width = 200;
    canvas.height = 50;

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('sho.rt fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('sho.rt fingerprint', 4, 17);

    const dataUrl = canvas.toDataURL();
    return await hashString(dataUrl);
  } catch {
    return 'canvas-error';
  }
}

/**
 * Gets WebGL renderer information
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) return 'no-webgl';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-debug-info';

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return `${vendor}~${renderer}`;
  } catch {
    return 'webgl-error';
  }
}

/**
 * Gets hardware information
 */
function getHardwareFingerprint(): string {
  const components: string[] = [];

  if (navigator.hardwareConcurrency) {
    components.push(`cores:${navigator.hardwareConcurrency}`);
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory) {
    components.push(`mem:${nav.deviceMemory}`);
  }

  if (navigator.maxTouchPoints !== undefined) {
    components.push(`touch:${navigator.maxTouchPoints}`);
  }

  return components.join('|') || 'no-hardware';
}

/**
 * Gets platform-specific information
 */
function getPlatformFingerprint(): string {
  const components: string[] = [];

  components.push(`screen:${window.screen.width}x${window.screen.height}`);
  components.push(`depth:${window.screen.colorDepth}`);
  components.push(`pixelRatio:${window.devicePixelRatio || 1}`);
  components.push(`avail:${window.screen.availWidth}x${window.screen.availHeight}`);

  return components.join('|');
}

/**
 * Collects all device fingerprint components
 */
async function collectDeviceFingerprint(): Promise<string> {
  const canvasFp = await getCanvasFingerprint();

  const components = {
    ua: navigator.userAgent,
    lang: navigator.language,
    langs: navigator.languages?.join(',') || navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    platform: getPlatformFingerprint(),
    hardware: getHardwareFingerprint(),
    canvas: canvasFp,
    webgl: getWebGLFingerprint(),
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || 'unset',
  };

  return JSON.stringify(components);
}

// ============================================================================
// Main Identity Functions
// ============================================================================

/**
 * Initializes or retrieves the cryptographic identity
 * 
 * Identity = SHA256(seed + deviceFingerprint + publicKey)
 * 
 * This creates a stable, unique, cryptographically secure identity
 * that is bound to this specific device/browser combination.
 */
export async function generateFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    // Check if we already have a complete identity
    const existingSeed = localStorage.getItem(STORAGE_KEYS.SEED);
    const existingPublicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    const existingPrivateKey = await getPrivateKey();

    let seed: string;
    let publicKeyHex: string;

    if (existingSeed && existingPublicKey && existingPrivateKey) {
      // Use existing identity components
      seed = existingSeed;
      publicKeyHex = existingPublicKey;
    } else {
      // Generate new identity components
      
      // 1. Generate 256-bit seed
      seed = generateSeed();
      localStorage.setItem(STORAGE_KEYS.SEED, seed);

      // 2. Generate ECDSA key pair
      const keyPair = await generateKeyPair();
      
      // 3. Store private key in IndexedDB (more secure)
      await storePrivateKey(keyPair.privateKey);
      
      // 4. Export and store public key
      publicKeyHex = await exportPublicKey(keyPair.publicKey);
      localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKeyHex);
    }

    // 5. Collect device fingerprint
    const deviceFingerprint = await collectDeviceFingerprint();

    // 6. Generate identity: SHA256(seed + fingerprint + publicKey)
    const identityInput = `${seed}|${deviceFingerprint}|${publicKeyHex}`;
    const identity = await hashString(identityInput);

    // Return first 32 chars (128 bits - more than sufficient for uniqueness)
    return identity.substring(0, 32);
  } catch (error) {
    console.error('Failed to generate identity:', error);
    return generateFallbackFingerprint();
  }
}

/**
 * Fallback for environments without full WebCrypto support
 */
function generateFallbackFingerprint(): string {
  // Generate a random seed
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const random = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const components = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${window.screen.width}x${window.screen.height}`,
    window.screen.colorDepth.toString(),
    random,
  ].join('|');

  // Simple hash for fallback
  let hash = 0;
  for (let i = 0; i < components.length; i++) {
    const char = components.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return (Math.abs(hash).toString(16) + random).substring(0, 32);
}

/**
 * Gets the stored public key for verification
 */
export function getPublicKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
}

export function getStoredFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('fp');
}

export function setStoredFingerprint(fp: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('fp', fp);
}
