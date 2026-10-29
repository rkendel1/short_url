'use client';

import { useEffect, useState } from 'react';
import { EditLinkModal } from './EditLinkModal';
import { signedFetch } from '@/lib/signed-fetch';

interface Link {
  code: string;
  url: string;
  clicks: number;
  created: number;
  updated?: number;
  revision: number;
  protected: boolean;
}

interface MyLinksProps {
  fingerprint: string;
  refresh: number;
}

export function MyLinks({ fingerprint, refresh }: MyLinksProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadLinks = async () => {
    try {
      // Fetch user's links from server
      const response = await fetch('/api/my-links', {
        headers: { 'x-fingerprint': fingerprint },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch links');
      }

      const data = await response.json();
      setLinks(data.links || []);
    } catch (err) {
      console.error('Failed to load links:', err);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, [fingerprint, refresh]);

  const handleCopy = (code: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (link: Link) => {
    if (!confirm('Delete this link? Its code can never be reused.')) return;

    let pin: string | undefined;
    if (link.protected) {
      pin = prompt('This link is PIN-protected. Enter its PIN to delete it:') ?? undefined;
      if (!pin) return;
    }

    try {
      const response = await signedFetch(fingerprint, 'DELETE', `/api/links/${link.code}`, {
        revision: link.revision,
        pin,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete link');
      }
      setLinks(links.filter((l) => l.code !== link.code));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete link');
      // Reload on error to show actual state
      loadLinks();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="links-section">
        <h2>My Links</h2>
        <div className="empty-state">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="links-section">
        <h2>My Links</h2>
        <div className="empty-state">
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px', fontWeight: '600' }}>
              No links yet
            </h3>
            <p style={{ color: '#666', marginBottom: '20px', lineHeight: '1.5' }}>
              Create your first short link above to get started.
            </p>
            <p style={{ fontSize: '13px', color: '#999' }}>
              Your links will appear here and be linked to your device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="links-section">
      <h2>My Links ({links.length})</h2>
      {links.map((link) => (
        <div key={link.code} className="link-item">
          <div className="link-item-header">
            <span className="link-code">{link.code}</span>
          </div>
          <div className="link-stats">
            <span>👁️ {link.clicks} clicks</span>
            <span>📅 {formatDate(link.created)}</span>
          </div>
          <div className="link-url">{link.url}</div>
          <div className="link-actions">
            <button
              className="secondary"
              onClick={() =>
                handleCopy(
                  link.code,
                  `https://0-2.ca/${link.code}`
                )
              }
            >
              {copied === link.code ? '✓ Copied!' : 'Copy'}
            </button>
            <button
              className="secondary"
              onClick={() => setEditingCode(link.code)}
            >
              ✏️ Edit
            </button>
            <button
              className="secondary danger"
              onClick={() => handleDelete(link)}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      ))}

      {editingCode && (
        <EditLinkModal
          code={editingCode}
          currentUrl={links.find((l) => l.code === editingCode)?.url || ''}
          revision={links.find((l) => l.code === editingCode)?.revision ?? 1}
          fingerprint={fingerprint}
          onClose={() => setEditingCode(null)}
          onUpdate={() => {
            setEditingCode(null);
            loadLinks();
          }}
        />
      )}
    </div>
  );
}
