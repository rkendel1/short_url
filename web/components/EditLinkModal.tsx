'use client';

import { useState } from 'react';
import { signedFetch } from '@/lib/signed-fetch';

interface EditLinkModalProps {
  code: string;
  currentUrl: string;
  revision: number;
  fingerprint: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function EditLinkModal({
  code,
  currentUrl,
  revision,
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
      const response = await signedFetch(fingerprint, 'PATCH', `/api/links/${code}`, {
        url: newUrl,
        revision,
        pin: pin || undefined,
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409) {
          throw new Error('This link was changed elsewhere. Close and reopen it to edit the latest version.');
        }
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
