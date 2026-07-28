import React, { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  shape: 'circle' | 'square';
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}

const OUTPUT_SIZE = 800;

/**
 * Full-screen image cropper. Supports single-finger pan and two-finger pinch-zoom.
 * Outputs an 800×800 JPEG blob of the cropped region.
 */
const ImageCropper = ({ src, shape, onCrop, onCancel }: Props) => {
  const [ready, setReady] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureLayerRef = useRef<HTMLDivElement>(null);

  // Crop window size — fills most of the narrower phone dimension
  const cropSize = Math.min(window.innerWidth - 48, 300);

  // Transform state in refs (avoids re-renders on every touch move)
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const minScaleRef = useRef(1);

  const applyTransform = () => {
    if (!imgRef.current) return;
    const { x, y } = offsetRef.current;
    imgRef.current.style.transform =
      `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scaleRef.current})`;
  };

  const handleImageLoad = () => {
    const img = imgRef.current!;
    // Cover the crop window from the start
    const minScale = Math.max(cropSize / img.naturalWidth, cropSize / img.naturalHeight);
    minScaleRef.current = minScale;
    scaleRef.current = minScale;
    offsetRef.current = { x: 0, y: 0 };
    applyTransform();
    setReady(true);
  };

  const handleCrop = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !ready) return;

    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Map crop window (in display px) back to source image coordinates
    const s = scaleRef.current;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;
    const srcX = img.naturalWidth / 2 + (-cropSize / 2 - ox) / s;
    const srcY = img.naturalHeight / 2 + (-cropSize / 2 - oy) / s;
    const srcW = cropSize / s;
    const srcH = cropSize / s;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob(blob => { if (blob) onCrop(blob); }, 'image/jpeg', 0.92);
  };

  // Non-passive touch handlers for pan + pinch (must use addEventListener to call preventDefault)
  useEffect(() => {
    const el = gestureLayerRef.current;
    if (!el) return;

    // Clamp offset so the image always covers the crop window
    const clamp = (offset: { x: number; y: number }, scale: number) => {
      const img = imgRef.current;
      if (!img) return offset;
      const maxX = Math.max(0, (img.naturalWidth * scale - cropSize) / 2);
      const maxY = Math.max(0, (img.naturalHeight * scale - cropSize) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, offset.x)),
        y: Math.max(-maxY, Math.min(maxY, offset.y)),
      };
    };

    type GState = {
      type: 'pan' | 'pinch';
      startOffset: { x: number; y: number };
      startScale: number;
      touch1?: { x: number; y: number };
      pinchDist?: number;
    };
    let g: GState | null = null;

    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        g = {
          type: 'pan',
          startOffset: { ...offsetRef.current },
          startScale: scaleRef.current,
          touch1: { x: e.touches[0].clientX, y: e.touches[0].clientY },
        };
      } else if (e.touches.length >= 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        g = {
          type: 'pinch',
          startOffset: { ...offsetRef.current },
          startScale: scaleRef.current,
          pinchDist: Math.hypot(dx, dy),
        };
      }
    };

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!g) return;

      if (g.type === 'pan' && e.touches.length === 1 && g.touch1) {
        const dx = e.touches[0].clientX - g.touch1.x;
        const dy = e.touches[0].clientY - g.touch1.y;
        offsetRef.current = clamp(
          { x: g.startOffset.x + dx, y: g.startOffset.y + dy },
          scaleRef.current,
        );
        applyTransform();
      } else if (e.touches.length >= 2 && g.pinchDist) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const newScale = Math.max(
          minScaleRef.current,
          Math.min(minScaleRef.current * 5, g.startScale * (dist / g.pinchDist)),
        );
        scaleRef.current = newScale;
        offsetRef.current = clamp(g.startOffset, newScale);
        applyTransform();
      }
    };

    const onEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 0) g = null;
    };

    const opts = { passive: false };
    el.addEventListener('touchstart', onStart, opts);
    el.addEventListener('touchmove', onMove, opts);
    el.addEventListener('touchend', onEnd, opts);
    return () => {
      el.removeEventListener('touchstart', onStart, opts);
      el.removeEventListener('touchmove', onMove, opts);
      el.removeEventListener('touchend', onEnd, opts);
    };
  }, [cropSize]);

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col">
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 py-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <button
          onPointerDown={e => { e.preventDefault(); onCancel(); }}
          className="text-white/70 text-sm font-medium active:opacity-50 py-2 pr-4"
        >
          Cancel
        </button>
        <span className="text-white text-sm font-semibold">
          {shape === 'circle' ? 'Edit Profile Photo' : 'Crop Photo'}
        </span>
        <div className="w-20" />
      </div>

      {/* Image + gesture area */}
      <div className="flex-1 relative overflow-hidden">
        {/* The image — positioned imperatively by applyTransform() */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          onLoad={handleImageLoad}
          draggable={false}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transformOrigin: 'center',
            userSelect: 'none',
            pointerEvents: 'none',
            maxWidth: 'none',
            maxHeight: 'none',
          }}
        />

        {/* Dark overlay with crop-shape cutout (box-shadow creates the dim effect) */}
        {ready && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={shape === 'circle' ? 'rounded-full' : 'rounded-2xl'}
              style={{
                width: cropSize,
                height: cropSize,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
                border: '2px solid rgba(255,255,255,0.45)',
              }}
            />
          </div>
        )}

        {/* Touch capture layer — sits above overlay so gestures work everywhere */}
        <div
          ref={gestureLayerRef}
          className="absolute inset-0"
          style={{ touchAction: 'none' }}
        />

        {/* Hint text below crop window */}
        {ready && (
          <p
            className="absolute left-0 right-0 text-center text-white/40 text-xs pointer-events-none select-none"
            style={{ top: '50%', marginTop: cropSize / 2 + 14 }}
          >
            Pinch to zoom · Drag to reposition
          </p>
        )}
      </div>

      {/* Use Photo button */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <button
          onPointerDown={e => { e.preventDefault(); handleCrop(); }}
          disabled={!ready}
          className="w-full h-14 rounded-2xl bg-clean text-clean-foreground font-semibold text-base active:scale-95 transition-all disabled:opacity-40"
        >
          Use Photo
        </button>
      </div>

      {/* Off-screen canvas used to produce the cropped output */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default ImageCropper;
