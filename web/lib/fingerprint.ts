import crypto from 'crypto';

export async function generateFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return '';
  }

  const components = {
    ua: navigator.userAgent,
    lang: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${window.screen.width}x${window.screen.height}`,
    colorDepth: window.screen.colorDepth,
    timestamp: Date.now(),
  };

  const fingerprint = JSON.stringify(components);
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32);
}

export function getStoredFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('fp');
}

export function setStoredFingerprint(fp: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('fp', fp);
}
