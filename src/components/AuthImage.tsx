import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { fetchPassageImageUrl } from '../utils/api';

interface AuthImageProps {
  passageId: string;
  alt: string;
  className?: string;
}

export function AuthImage({ passageId, alt, className = '' }: AuthImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setError(false);
    fetchPassageImageUrl(passageId)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [passageId]);

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-slate-100 p-4 text-center text-slate-500 ${className}`}
      >
        <ImageOff className="h-6 w-6 text-slate-400" />
        <span className="text-xs font-medium">{alt}</span>
      </div>
    );
  }

  if (!src) {
    return <div className={`animate-pulse bg-slate-100 ${className}`} aria-label={alt} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setError(true)}
    />
  );
}
