import { ImageOff } from 'lucide-react';
import { useState } from 'react';

/** Square image with a fixed aspect ratio (no layout shift) and a fallback on error. */
export function ProductImage({
  src,
  alt,
  className = '',
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative aspect-square overflow-hidden rounded-xl bg-slate-900 ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-vape-accent">
          {src ? (
            <ImageOff className="size-8" aria-hidden />
          ) : (
            <span className="text-3xl font-black">V</span>
          )}
        </div>
      )}
    </div>
  );
}
