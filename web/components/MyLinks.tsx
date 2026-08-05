'use client';

import { useEffect, useState } from 'react';
import { EditLinkModal } from './EditLinkModal';
import { getAllLinks, deleteLink as deleteLinkFromDB } from '@/lib/browser-db';
import { syncFromServerLinks, syncChanges, queueChange } from '@/lib/sync';

interface Link {
  code: string;
  url: string;
  clicks: number;
  created: number;
  updated?: number;
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
      // Load from browser DB first (fast)
      const cachedLinks = await getAllLinks();
      setLinks(cachedLinks.map(link => ({
        code: link.code,
        url: link.url,
        clicks: link.clicks,
        created: link.created,
        updated: link.updated,
      })));

      // Sync from server in background
      await syncFromServerLinks(fingerprint);

      // Reload from browser DB (now synced)
      const syncedLinks = await getAllLinks();
      setLinks(syncedLinks.map(link => ({
        code: link.code,
        url: link.url,
        clicks: link.clicks,
        created: link.created,
        updated: link.updated,
      })));
    } catch (err) {
      console.error('Failed to load links:', err);
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

  const handleDelete = async (code: string) => {
    if (!confirm('Delete this link?')) return;

    try {
      // Delete from browser DB immediately (UX)
      await deleteLinkFromDB(code);
      setLinks(links.filter(l => l.code !== code));

      // Queue sync to server
      queueChange({ type: 'delete', code });
      await syncChanges(fingerprint);
    } catch (err) {
      console.error('Failed to delete link:', err);
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
          <p>No links created yet. Create one above!</p>
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
                  `https://sho.rt/${link.code}`
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
              onClick={() => handleDelete(link.code)}
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
