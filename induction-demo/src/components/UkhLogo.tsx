import React from 'react';

interface UkhLogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'horizontal';
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
};

export const UkhLogo: React.FC<UkhLogoProps> = ({
  className = '',
  showText = true,
  size = 'md',
  variant = 'full',
}) => {
  const sunRays = Array.from({ length: 21 }).map((_, i) => (
    <path
      key={i}
      d="M 0 -60 L 6 -40 L -6 -40 Z"
      fill="#FFD100"
      transform={`rotate(${(i * 360) / 21})`}
    />
  ));

  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${sizeClasses[size]} ${className}`}>
        <svg viewBox="0 0 500 300" className="w-full h-full">
          <rect width="500" height="100" fill="#E41E20" />
          <rect y="100" width="500" height="100" fill="#FFFFFF" />
          <rect y="200" width="500" height="100" fill="#278E43" />
          <g transform="translate(250, 150)">
            <circle r="42" fill="#FFD100" />
            {sunRays}
          </g>
        </svg>
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <svg viewBox="0 0 500 300" className="w-10 h-6" aria-hidden="true">
          <rect width="500" height="100" fill="#E41E20" />
          <rect y="100" width="500" height="100" fill="#FFFFFF" />
          <rect y="200" width="500" height="100" fill="#278E43" />
          <g transform="translate(250, 150)">
            <circle r="42" fill="#FFD100" />
            {sunRays}
          </g>
        </svg>
        {showText && (
          <div className="flex flex-col leading-tight">
            <span className="font-black text-lg tracking-[0.1em] text-[var(--text-main)]">Kurdistan</span>
            <span className="text-xs tracking-[0.3em] uppercase text-[var(--text-muted)]">Heritage Arena</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} relative overflow-hidden rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]`}>
        <svg viewBox="0 0 500 300" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <rect width="500" height="100" fill="#E41E20" />
          <rect y="100" width="500" height="100" fill="#FFFFFF" />
          <rect y="200" width="500" height="100" fill="#278E43" />
          <g transform="translate(250, 150)">
            <circle r="42" fill="#FFD100" />
            {sunRays}
          </g>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/30 pointer-events-none" />
      </div>
      {showText && (
        <div className="mt-4 flex flex-col items-center text-center">
          <span className="font-display font-black text-xl tracking-[0.15em] uppercase text-[var(--text-main)] drop-shadow-lg">
            Kurdistan
          </span>
          <span className="text-sm tracking-[0.4em] uppercase text-[var(--text-muted)] mt-1">
            Heritage Arena
          </span>
        </div>
      )}
    </div>
  );
};

export default UkhLogo;