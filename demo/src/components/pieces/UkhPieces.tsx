import React from 'react';
import { PieceType, PieceColor } from '../../types/chess';

interface UkhPieceProps {
  type: PieceType;
  color: PieceColor;
  className?: string;
  size?: number;
}

const UKH_COLORS = {
  w: {
    mainBody: '#FDFCF7',
    borderStroke: '#1A3B5C',
    goldAccent: '#D4AF37',
    navyAccent: '#1A3B5C',
    accent: '#E8EEF5',
  },
  b: {
    mainBody: '#1A2A3A',
    borderStroke: '#D4AF37',
    goldAccent: '#D4AF37',
    navyAccent: '#1A3B5C',
    accent: '#2D4A6B',
  },
};

export const UkhPawn: React.FC<{ color: PieceColor; className?: string; size?: number }> = ({ color, className = '', size = 45 }) => {
  const c = UKH_COLORS[color];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`ukh-pawn-grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color === 'w' ? '#FFFFFF' : '#2D4A6B'} />
          <stop offset="100%" stopColor={color === 'w' ? '#E8EEF5' : '#1A2A3A'} />
        </linearGradient>
        <radialGradient id={`ukh-sun-glow-${color}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF8E7" />
          <stop offset="100%" stopColor={c.goldAccent} />
        </radialGradient>
      </defs>
      <g stroke={c.borderStroke} strokeWidth={`${size * 0.035}`} strokeLinecap="round" strokeLinejoin="round">
        <path
          d={`M ${size * 0.5} ${size * 0.18} C ${size * 0.44} ${size * 0.18} ${size * 0.4} ${size * 0.28} ${size * 0.4} ${size * 0.35} C ${size * 0.4} ${size * 0.45} ${size * 0.43} ${size * 0.47} ${size * 0.47} ${size * 0.5} C ${size * 0.39} ${size * 0.53} ${size * 0.36} ${size * 0.58} ${size * 0.36} ${size * 0.62} C ${size * 0.36} ${size * 0.66} ${size * 0.38} ${size * 0.7} ${size * 0.41} ${size * 0.73} C ${size * 0.34} ${size * 0.76} ${size * 0.24} ${size * 0.85} ${size * 0.24} ${size * 0.95} L ${size * 0.76} ${size * 0.95} C ${size * 0.76} ${size * 0.85} ${size * 0.66} ${size * 0.76} ${size * 0.59} ${size * 0.73} C ${size * 0.53} ${size * 0.7} ${size * 0.54} ${size * 0.66} ${size * 0.54} ${size * 0.62} C ${size * 0.54} ${size * 0.58} ${size * 0.57} ${size * 0.53} ${size * 0.53} ${size * 0.5} C ${size * 0.57} ${size * 0.47} ${size * 0.6} ${size * 0.45} ${size * 0.6} ${size * 0.35} C ${size * 0.6} ${size * 0.28} ${size * 0.56} ${size * 0.18} ${size * 0.5} ${size * 0.18} Z`}
          fill={`url(#ukh-pawn-grad-${color})`}
        />
        {/* University sash motif */}
        <path d={`M ${size * 0.32} ${size * 0.79} L ${size * 0.68} ${size * 0.79}`} stroke={c.goldAccent} strokeWidth={`${size * 0.05}`} />
        <path d={`M ${size * 0.38} ${size * 0.72} L ${size * 0.62} ${size * 0.72}`} stroke={c.navyAccent} strokeWidth={`${size * 0.035}`} />
        {/* 21-ray sun head ring */}
        <circle cx={`${size * 0.5}`} cy={`${size * 0.28}`} r={`${size * 0.05}`} fill={c.goldAccent} stroke={c.borderStroke} strokeWidth={`${size * 0.02}`} />
      </g>
    </svg>
  );
};

export const UkhKnight: React.FC<{ color: PieceColor; className?: string; size?: number }> = ({ color, className = '', size = 45 }) => {
  const c = UKH_COLORS[color];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`ukh-knight-grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color === 'w' ? '#FFFFFF' : '#2D4A6B'} />
          <stop offset="100%" stopColor={color === 'w' ? '#E8EEF5' : '#1A2A3A'} />
        </linearGradient>
      </defs>
      <g stroke={c.borderStroke} strokeWidth={`${size * 0.035}`} strokeLinecap="round" strokeLinejoin="round">
        <path
          d={`M ${size * 0.49} ${size * 0.18} C ${size * 0.73} ${size * 0.2} ${size * 0.87} ${size * 0.36} ${size * 0.84} ${size * 0.87} L ${size * 0.31} ${size * 0.87} C ${size * 0.31} ${size * 0.67} ${size * 0.53} ${size * 0.71} ${size * 0.49} ${size * 0.38} C ${size * 0.51} ${size * 0.44} ${size * 0.4} ${size * 0.53} ${size * 0.36} ${size * 0.58} C ${size * 0.29} ${size * 0.62} ${size * 0.29} ${size * 0.69} ${size * 0.23} ${size * 0.68} C ${size * 0.2} ${size * 0.66} ${size * 0.26} ${size * 0.61} ${size * 0.22} ${size * 0.66} C ${size * 0.16} ${size * 0.66} ${size * 0.11} ${size * 0.62} ${size * 0.12} ${size * 0.54} C ${size * 0.12} ${size * 0.53} ${size * 0.26} ${size * 0.29} ${size * 0.26} ${size * 0.29} C ${size * 0.26} ${size * 0.29} ${size * 0.3} ${size * 0.24} ${size * 0.3} ${size * 0.2} C ${size * 0.29} ${size * 0.18} ${size * 0.29} ${size * 0.16} ${size * 0.29} ${size * 0.13} C ${size * 0.31} ${size * 0.11} ${size * 0.36} ${size * 0.19} ${size * 0.36} ${size * 0.19} L ${size * 0.4} ${size * 0.19} C ${size * 0.4} ${size * 0.19} ${size * 0.42} ${size * 0.14} ${size * 0.46} ${size * 0.12} C ${size * 0.48} ${size * 0.12} ${size * 0.49} ${size * 0.18} ${size * 0.49} ${size * 0.18} Z`}
          fill={`url(#ukh-knight-grad-${color})`}
        />
        {/* Khanjar crest */}
        <path d={`M ${size * 0.44} ${size * 0.24} C ${size * 0.56} ${size * 0.29} ${size * 0.64} ${size * 0.4} ${size * 0.62} ${size * 0.58}`} stroke={c.goldAccent} strokeWidth={`${size * 0.04}`} fill="none" />
        {/* University sash */}
        <path d={`M ${size * 0.31} ${size * 0.79} L ${size * 0.78} ${size * 0.79}`} stroke={c.goldAccent} strokeWidth={`${size * 0.05}`} />
        {/* Golden harness star */}
        <circle cx={`${size * 0.47}`} cy={`${size * 0.42}`} r={`${size * 0.04}`} fill={c.goldAccent} stroke={c.borderStroke} strokeWidth={`${size * 0.02}`} />
        <circle cx={`${size * 0.2}`} cy={`${size * 0.53}`} r={`${size * 0.022}`} fill={c.goldAccent} stroke="none" />
      </g>
    </svg>
  );
};

export const UkhBishop: React.FC<{ color: PieceColor; className?: string; size?: number }> = ({ color, className = '', size = 45 }) => {
  const c = UKH_COLORS[color];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`ukh-bishop-grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color === 'w' ? '#FFFFFF' : '#2D4A6B'} />
          <stop offset="100%" stopColor={color === 'w' ? '#E8EEF5' : '#1A2A3A'} />
        </linearGradient>
      </defs>
      <g stroke={c.borderStroke} strokeWidth={`${size * 0.035}`} strokeLinecap="round" strokeLinejoin="round">
        {/* Base */}
        <path d={`M ${size * 0.22} ${size * 0.88} L ${size * 0.78} ${size * 0.88} L ${size * 0.76} ${size * 0.8} L ${size * 0.24} ${size * 0.8} Z`} fill={`url(#ukh-bishop-grad-${color})`} />
        {/* Mitre Body */}
        <path
          d={`M ${size * 0.31} ${size * 0.8} C ${size * 0.29} ${size * 0.69} ${size * 0.33} ${size * 0.62} ${size * 0.38} ${size * 0.58} C ${size * 0.38} ${size * 0.58} ${size * 0.31} ${size * 0.58} ${size * 0.31} ${size * 0.49} C ${size * 0.31} ${size * 0.4} ${size * 0.42} ${size * 0.24} ${size * 0.5} ${size * 0.18} C ${size * 0.58} ${size * 0.24} ${size * 0.69} ${size * 0.4} ${size * 0.69} ${size * 0.49} C ${size * 0.69} ${size * 0.58} ${size * 0.62} ${size * 0.58} ${size * 0.62} ${size * 0.58} C ${size * 0.67} ${size * 0.62} ${size * 0.71} ${size * 0.69} ${size * 0.69} ${size * 0.8} Z`}
          fill={`url(#ukh-bishop-grad-${color})`}
        />
        {/* Mitre slash */}
        <path d={`M ${size * 0.44} ${size * 0.31} L ${size * 0.56} ${size * 0.47}`} stroke={c.goldAccent} strokeWidth={`${size * 0.045}`} />
        <path d={`M ${size * 0.29} ${size * 0.8} L ${size * 0.71} ${size * 0.8}`} stroke={c.goldAccent} strokeWidth={`${size * 0.05}`} />
        <path d={`M ${size * 0.36} ${size * 0.73} L ${size * 0.64} ${size * 0.73}`} stroke={c.goldAccent} strokeWidth={`${size * 0.035}`} />
        {/* 21-ray sun crown orb */}
        <circle cx={`${size * 0.5}`} cy={`${size * 0.16}`} r={`${size * 0.055}`} fill={c.goldAccent} stroke={c.borderStroke} strokeWidth={`${size * 0.027}`} />
      </g>
    </svg>
  );
};

export const UkhRook: React.FC<{ color: PieceColor; className?: string; size?: number }> = ({ color, className = '', size = 45 }) => {
  const c = UKH_COLORS[color];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`ukh-rook-grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color === 'w' ? '#FFFFFF' : '#2D4A6B'} />
          <stop offset="100%" stopColor={color === 'w' ? '#E8EEF5' : '#1A2A3A'} />
        </linearGradient>
      </defs>
      <g stroke={c.borderStroke} strokeWidth={`${size * 0.035}`} strokeLinecap="round" strokeLinejoin="round">
        {/* Base */}
        <path d={`M ${size * 0.16} ${size * 0.88} L ${size * 0.84} ${size * 0.88} L ${size * 0.82} ${size * 0.8} L ${size * 0.18} ${size * 0.8} Z`} fill={`url(#ukh-rook-grad-${color})`} />
        {/* Tower body */}
        <path d={`M ${size * 0.22} ${size * 0.8} L ${size * 0.22} ${size * 0.25} L ${size * 0.34} ${size * 0.18} L ${size * 0.66} ${size * 0.18} L ${size * 0.78} ${size * 0.25} L ${size * 0.78} ${size * 0.8} Z`} fill={`url(#ukh-rook-grad-${color})`} />
        {/* Crenellations */}
        <path d={`M ${size * 0.22} ${size * 0.25} L ${size * 0.22} ${size * 0.15} L ${size * 0.34} ${size * 0.15} L ${size * 0.34} ${size * 0.25}`} fill={`url(#ukh-rook-grad-${color})`} />
        <path d={`M ${size * 0.38} ${size * 0.15} L ${size * 0.38} ${size * 0.08} L ${size * 0.46} ${size * 0.08} L ${size * 0.46} ${size * 0.15}`} fill={`url(#ukh-rook-grad-${color})`} />
        <path d={`M ${size * 0.54} ${size * 0.15} L ${size * 0.54} ${size * 0.08} L ${size * 0.62} ${size * 0.08} L ${size * 0.62} ${size * 0.15}`} fill={`url(#ukh-rook-grad-${color})`} />
        <path d={`M ${size * 0.66} ${size * 0.25} L ${size * 0.66} ${size * 0.15} L ${size * 0.78} ${size * 0.15} L ${size * 0.78} ${size * 0.25}`} fill={`url(#ukh-rook-grad-${color})`} />
        {/* University sash */}
        <path d={`M ${size * 0.31} ${size * 0.79} L ${size * 0.69} ${size * 0.79}`} stroke={c.goldAccent} strokeWidth={`${size * 0.05}`} />
        {/* Window with sun */}
        <circle cx={`${size * 0.5}`} cy={`${size * 0.5}`} r={`${size * 0.06}`} fill={c.goldAccent} stroke={c.borderStroke} strokeWidth={`${size * 0.02}`} />
      </g>
    </svg>
  );
};

export const UkhQueen: React.FC<{ color: PieceColor; className?: string; size?: number }> = ({ color, className = '', size = 45 }) => {
  const c = UKH_COLORS[color];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`ukh-queen-grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color === 'w' ? '#FFFFFF' : '#2D4A6B'} />
          <stop offset="100%" stopColor={color === 'w' ? '#E8EEF5' : '#1A2A3A'} />
        </linearGradient>
        <radialGradient id={`crown-glow-${color}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF8E7" />
          <stop offset="100%" stopColor={c.goldAccent} />
        </radialGradient>
      </defs>
      <g stroke={c.borderStroke} strokeWidth={`${size * 0.035}`} strokeLinecap="round" strokeLinejoin="round">
        {/* Base */}
        <path d={`M ${size * 0.18} ${size * 0.88} L ${size * 0.82} ${size * 0.88} L ${size * 0.8} ${size * 0.8} L ${size * 0.2} ${size * 0.8} Z`} fill={`url(#ukh-queen-grad-${color})`} />
        {/* Body */}
        <path d={`M ${size * 0.25} ${size * 0.8} L ${size * 0.22} ${size * 0.35} C ${size * 0.18} ${size * 0.3} ${size * 0.25} ${size * 0.22} ${size * 0.3} ${size * 0.2} C ${size * 0.4} ${size * 0.18} ${size * 0.6} ${size * 0.18} ${size * 0.7} ${size * 0.2} C ${size * 0.75} ${size * 0.22} ${size * 0.82} ${size * 0.3} ${size * 0.78} ${size * 0.35} L ${size * 0.75} ${size * 0.8} Z`} fill={`url(#ukh-queen-grad-${color})`} />
        {/* Crown with 7 points (chancellor's crown) */}
        <path d={`M ${size * 0.22} ${size * 0.35} L ${size * 0.3} ${size * 0.18} L ${size * 0.38} ${size * 0.35} L ${size * 0.46} ${size * 0.12} L ${size * 0.5} ${size * 0.35} L ${size * 0.54} ${size * 0.12} L ${size * 0.62} ${size * 0.35} L ${size * 0.7} ${size * 0.18} L ${size * 0.78} ${size * 0.35} Z`} fill={c.goldAccent} stroke={c.borderStroke} strokeWidth={`${size * 0.02}`} />
        {/* Crown orbs - 7 points for chancellor */}
        {Array.from({ length: 7 }).map((_, i) => (
          <circle
            key={i}
            cx={`${size * (0.25 + i * 0.08)}`}
            cy={`${size * (i % 2 === 0 ? 0.18 : 0.12)}`}
            r={`${size * 0.03}`}
            fill={c.goldAccent}
            stroke={c.borderStroke}
            strokeWidth={`${size * 0.015}`}
          />
        ))}
        {/* University sash */}
        <path d={`M ${size * 0.31} ${size * 0.79} L ${size * 0.69} ${size * 0.79}`} stroke={c.goldAccent} strokeWidth={`${size * 0.05}`} />
        {/* Central gem */}
        <circle cx={`${size * 0.5}`} cy={`${size * 0.5}`} r={`${size * 0.055}`} fill={c.goldAccent} stroke={c.borderStroke} strokeWidth={`${size * 0.02}`} />
      </g>
    </svg>
  );
};

export const UkhKing: React.FC<{ color: PieceColor; className?: string; size?: number }> = ({ color, className = '', size = 45 }) => {
  const c = UKH_COLORS[color];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`ukh-king-grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color === 'w' ? '#FFFFFF' : '#2D4A6B'} />
          <stop offset="100%" stopColor={color === 'w' ? '#E8EEF5' : '#1A2A3A'} />
        </linearGradient>
        <radialGradient id={`crown-glow-king-${color}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF8E7" />
          <stop offset="100%" stopColor={c.goldAccent} />
        </radialGradient>
      </defs>
      <g stroke={c.borderStroke} strokeWidth={`${size * 0.035}`} strokeLinecap="round" strokeLinejoin="round">
        {/* Base */}
        <path d={`M ${size * 0.16} ${size * 0.88} L ${size * 0.84} ${size * 0.88} L ${size * 0.82} ${size * 0.8} L ${size * 0.18} ${size * 0.8} Z`} fill={`url(#ukh-king-grad-${color})`} />
        {/* Body */}
        <path d={`M ${size * 0.22} ${size * 0.8} L ${size * 0.18} ${size * 0.3} C ${size * 0.14} ${size * 0.25} ${size * 0.22} ${size * 0.18} ${size * 0.3} ${size * 0.15} C ${size * 0.4} ${size * 0.12} ${size * 0.6} ${size * 0.12} ${size * 0.7} ${size * 0.15} C ${size * 0.78} ${size * 0.18} ${size * 0.86} ${size * 0.25} ${size * 0.82} ${size * 0.3} L ${size * 0.78} ${size * 0.8} Z`} fill={`url(#ukh-king-grad-${color})`} />
        {/* Crown with 9 points (king's crown) */}
        <path d={`M ${size * 0.18} ${size * 0.3} L ${size * 0.26} ${size * 0.12} L ${size * 0.34} ${size * 0.3} L ${size * 0.42} ${size * 0.08} L ${size * 0.5} ${size * 0.3} L ${size * 0.58} ${size * 0.08} L ${size * 0.66} ${size * 0.3} L ${size * 0.74} ${size * 0.12} L ${size * 0.82} ${size * 0.3} Z`} fill={c.goldAccent} stroke={c.borderStroke} strokeWidth={`${size * 0.02}`} />
        {/* Crown orbs - 9 points for king */}
        {Array.from({ length: 9 }).map((_, i) => (
          <circle
            key={i}
            cx={`${size * (0.18 + i * 0.08)}`}
            cy={`${size * (i % 2 === 0 ? 0.15 : 0.08)}`}
            r={`${size * 0.03}`}
            fill={c.goldAccent}
            stroke={c.borderStroke}
            strokeWidth={`${size * 0.015}`}
          />
        ))}
        {/* Cross on center */}
        <path d={`M ${size * 0.5} ${size * 0.06} L ${size * 0.5} ${size * 0.18} M ${size * 0.44} ${size * 0.12} L ${size * 0.56} ${size * 0.12}`} stroke={c.goldAccent} strokeWidth={`${size * 0.04}`} strokeLinecap="round" />
        {/* University sash */}
        <path d={`M ${size * 0.31} ${size * 0.79} L ${size * 0.69} ${size * 0.79}`} stroke={c.goldAccent} strokeWidth={`${size * 0.05}`} />
        {/* Central sun */}
        <circle cx={`${size * 0.5}`} cy={`${size * 0.5}`} r={`${size * 0.055}`} fill={c.goldAccent} stroke={c.borderStroke} strokeWidth={`${size * 0.02}`} />
      </g>
    </svg>
  );
};

export function getUkhPiece({ type, color, className = '', size = 45 }: UkhPieceProps) {
  switch (type) {
    case 'p': return <UkhPawn color={color} className={className} size={size} />;
    case 'n': return <UkhKnight color={color} className={className} size={size} />;
    case 'b': return <UkhBishop color={color} className={className} size={size} />;
    case 'r': return <UkhRook color={color} className={className} size={size} />;
    case 'q': return <UkhQueen color={color} className={className} size={size} />;
    case 'k': return <UkhKing color={color} className={className} size={size} />;
    default: return <UkhPawn color={color} className={className} size={size} />;
  }
}