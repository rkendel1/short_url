'use client';

import { useEffect, useState } from 'react';
import { EditLinkModal } from './EditLinkModal';

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

  const fetchLinks = async () => {
    try {
      const response = await fetch('/api/my-links', {
        headers: { 'x-fingerprint': fingerprint },
      });

      if (response.ok) {
        const data = await response.json();
        setLinks(data.links);
      }
    } catch (err) {
      console.error('Failed to fetch links:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [fingerprint, refresh]);

  const handleCopy = (code: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

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
            fetchLinks();
          }}
        />
      )}
    </div>
  );
}
