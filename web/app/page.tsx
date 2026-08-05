'use client';

import { useEffect, useState } from 'react';
import { generateFingerprint, getStoredFingerprint, setStoredFingerprint } from '@/lib/fingerprint';
import { ShortenForm } from '@/components/ShortenForm';
import { MyLinks } from '@/components/MyLinks';

export default function Home() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const initFingerprint = async () => {
      try {
        let fp = getStoredFingerprint();
        if (!fp) {
          fp = await generateFingerprint();
          if (fp) {
            setStoredFingerprint(fp);
          }
        }
        if (fp) {
          setFingerprint(fp);
        } else {
          setInitError('Unable to initialize user session. Please try refreshing the page.');
        }
      } catch (error) {
        console.error('Failed to initialize fingerprint:', error);
        setInitError('Unable to initialize user session. Please try refreshing the page.');
      } finally {
        setIsInitializing(false);
      }
    };

    initFingerprint();
  }, []);

  if (isInitializing) {
    return (
      <main>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Initializing...</p>
        </div>
      </main>
    );
  }

  if (initError || !fingerprint) {
    return (
      <main>
        <h1>🔗 sho.rt</h1>
        <p className="subtitle">Shareable URLs with editable destinations</p>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#e74c3c' }}>{initError || 'Unable to load. Please refresh the page.'}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '16px' }}>
            Refresh Page
          </button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>🔗 sho.rt</h1>
      <p className="subtitle">Shareable URLs with editable destinations</p>

      <ShortenForm
        fingerprint={fingerprint}
        onLinkCreated={() => setRefreshTrigger((prev) => prev + 1)}
      />

      <MyLinks fingerprint={fingerprint} refresh={refreshTrigger} />
    </main>
  );
}
