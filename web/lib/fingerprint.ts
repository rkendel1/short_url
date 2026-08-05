export async function generateFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const components = {
      ua: navigator.userAgent,
      lang: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${window.screen.width}x${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      timestamp: Date.now(),
    };

    const fingerprint = JSON.stringify(components);
    const hash = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(fingerprint)
    );

    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 32);
  } catch (error) {
    console.error('Failed to generate fingerprint:', error);
    return generateFallbackFingerprint();
  }
}

function generateFallbackFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${window.screen.width}x${window.screen.height}`,
    window.screen.colorDepth.toString(),
    Date.now().toString(),
  ].join('|');

  let hash = 0;
  for (let i = 0; i < components.length; i++) {
    const char = components.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(32, '0').substring(0, 32);
}

export function getStoredFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('fp');
}

export function setStoredFingerprint(fp: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('fp', fp);
}
