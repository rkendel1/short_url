'use client';

import { useEffect, useState } from 'react';
import { generateFingerprint, getStoredFingerprint, setStoredFingerprint } from '@/lib/fingerprint';
import { ShortenForm } from '@/components/ShortenForm';
import { MyLinks } from '@/components/MyLinks';

export default function Home() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const initFingerprint = async () => {
      let fp = getStoredFingerprint();
      if (!fp) {
        fp = await generateFingerprint();
        if (fp) {
          setStoredFingerprint(fp);
        }
      }
      setFingerprint(fp);
    };

    initFingerprint();
  }, []);

  if (!fingerprint) {
    return (
      <main>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Initializing...</p>
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
