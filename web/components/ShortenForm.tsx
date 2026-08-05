'use client';

import { useState } from 'react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { EditLinkModal } from './EditLinkModal';
import { saveLink } from '@/lib/browser-db';
import { queueChange, syncChanges } from '@/lib/sync';

interface ShortenFormProps {
  fingerprint: string;
  onLinkCreated: () => void;
}

interface LinkResult {
  shortCode: string;
  shortUrl: string;
}

export function ShortenForm({ fingerprint, onLinkCreated }: ShortenFormProps) {
  const [url, setUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LinkResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const now = Math.floor(Date.now() / 1000);

      // Save to browser DB first (optimistic update)
      const link = {
        code: customCode || `temp-${Date.now()}`,
        url,
        clicks: 0,
        created: now,
      };
      await saveLink(link);

      // Send to backend
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          customCode: customCode || undefined,
          fingerprint,
          pin: pin || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to shorten URL');
      }

      const data = await response.json();

      // Update browser DB with actual code from server
      if (data.shortCode && data.shortCode !== link.code) {
        await saveLink({
          ...link,
          code: data.shortCode,
        });
      }

      // Queue sync to ensure it's on backend
      queueChange({
        type: 'create',
        code: data.shortCode,
        url,
        pin: pin || undefined,
      });
      await syncChanges(fingerprint);

      setResult(data);
      setUrl('');
      setCustomCode('');
      setPin('');
      onLinkCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
        {error && <div className="error">{error}</div>}

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="url" className="label">
            URL to Shorten
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/very/long/url"
            required
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="customCode" className="label">
            Custom Code (optional)
          </label>
          <input
            id="customCode"
            type="text"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
            placeholder="e.g., PROMO or leave empty for auto-generated"
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label htmlFor="pin" className="label">
            PIN for Updates (optional)
          </label>
          <input
            id="pin"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Protect this link with a PIN"
            style={{ width: '100%' }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Creating...' : 'Create Short Link'}
        </button>
      </form>

      {result && (
        <div className="result-section">
          <div className="result-item">
            <div className="label">Your Short Link</div>
            <div className="result-text">{result.shortUrl}</div>
            <div className="actions">
              <button className="secondary" onClick={handleCopy}>
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <div className="label">QR Code</div>
            <div className="qr-container">
              <QRCodeDisplay shortUrl={result.shortUrl} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
