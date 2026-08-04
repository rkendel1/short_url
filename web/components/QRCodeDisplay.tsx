'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  shortUrl: string;
  onDownload?: () => void;
}

export function QRCodeDisplay({ shortUrl, onDownload }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, shortUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
    }
  }, [shortUrl]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.href = canvasRef.current.toDataURL('image/png');
      link.download = `qr-${shortUrl.split('/').pop()}.png`;
      link.click();
      onDownload?.();
    }
  };

  return (
    <div className="qr-box">
      <canvas ref={canvasRef} />
      <button className="secondary" onClick={handleDownload}>
        Download QR
      </button>
    </div>
  );
}
