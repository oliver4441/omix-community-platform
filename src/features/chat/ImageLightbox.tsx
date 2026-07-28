'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Download, ZoomIn, ZoomOut } from '@/components/ui/icons';

export function ImageLightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.25, 4));
      if (e.key === '-') setZoom((z) => Math.max(z - 0.25, 0.5));
      if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY > 0) setZoom((z) => Math.max(z - 0.1, 0.5));
    else setZoom((z) => Math.min(z + 0.1, 4));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  const handleDownload = async () => {
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'image.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors z-10"
        aria-label="Close image"
      >
        <X size={20} />
      </button>

      {/* Zoom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-[20px] px-3 py-2 z-10">
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-white text-sm font-medium min-w-[48px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <div className="w-px h-6 bg-white/20 mx-1" />
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="text-white/70 hover:text-white text-xs font-medium px-2 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleDownload}
          className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-colors"
          title="Download"
        >
          <Download size={16} />
        </button>
      </div>

      {/* Image */}
      <img
        src={src}
        alt=""
        className="max-w-[95vw] max-h-[90vh] object-contain select-none"
        style={{
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transition: dragging.current ? 'none' : 'transform 0.2s ease',
          cursor: zoom > 1 ? 'grab' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        draggable={false}
      />
    </div>
  );
}
