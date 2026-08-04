'use client';

import { useState } from 'react';

interface EditLinkModalProps {
  code: string;
  currentUrl: string;
  fingerprint: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function EditLinkModal({
  code,
  currentUrl,
  fingerprint,
  onClose,
  onUpdate,
}: EditLinkModalProps) {
  const [newUrl, setNewUrl] = useState(currentUrl);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/links/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl,
          fingerprint,
          pin: pin || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update');
      }

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <span className="modal-close" onClick={onClose}>
          ×
        </span>
        <h2>Edit Destination</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="error">{error}</div>}

          <div style={{ marginBottom: '16px' }}>
            <label className="label">Short Code</label>
            <div className="result-text">{code}</div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="newUrl" className="label">
              New Destination URL
            </label>
            <input
              id="newUrl"
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="pin" className="label">
              PIN (if set)
            </label>
            <input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Leave empty if no PIN was set"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Destination'}
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
