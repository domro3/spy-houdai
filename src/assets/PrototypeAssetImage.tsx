import { useState, type ReactNode } from 'react';

export function PrototypeAssetImage({
  src,
  alt,
  className,
  fallback = null,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return fallback;

  return (
    <img
      src={src}
      alt={alt}
      className={['prototype-asset', className].filter(Boolean).join(' ')}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
