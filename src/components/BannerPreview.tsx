import React, { useMemo } from 'react';
import { BannerSpec } from '../types';
import { bannerSvg } from '../bannerRenderer';

interface BannerPreviewProps {
  spec: Partial<BannerSpec>;
  className?: string;
  allowDownload?: boolean;
}

export const BannerPreview: React.FC<BannerPreviewProps> = ({ spec, className = '', allowDownload = false }) => {
  const svgString = useMemo(() => {
    try {
      return bannerSvg(spec);
    } catch {
      return '';
    }
  }, [spec]);

  const handleDownload = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banner-${spec.headline || 'hustlify'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!svgString) {
    return <div className="thumb-wrap" style={{ background: '#121318' }} />;
  }

  return (
    <div className={`thumb-wrap ${className}`} style={{ position: 'relative' }}>
      <div
        dangerouslySetInnerHTML={{ __html: svgString }}
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      />
      {allowDownload && (
        <button
          onClick={handleDownload}
          className="b s"
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            color: '#fff',
            fontSize: '11px',
            padding: '4px 8px',
          }}
          title="Скачать SVG"
        >
          Скачать SVG
        </button>
      )}
    </div>
  );
};
