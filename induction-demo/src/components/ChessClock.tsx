import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { formatTimeLong } from '../utils/chessEngine';
import { TimeControl } from '../types/chess';

interface ChessClockProps {
  whiteTime: number;
  blackTime: number;
  activeColor: 'w' | 'b';
  timeControl: TimeControl;
  onTimeUpdate: (whiteTime: number, blackTime: number) => void;
  onFlagFall: (color: 'w' | 'b') => void;
  paused?: boolean;
}

export const ChessClock: React.FC<ChessClockProps> = ({
  whiteTime,
  blackTime,
  activeColor,
  timeControl,
  onTimeUpdate,
  onFlagFall,
  paused = false,
}) => {
  const lastTickRef = useRef<number>(performance.now());
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) return;

    const tick = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (activeColor === 'w') {
        const newWhiteTime = Math.max(0, whiteTime - delta);
        onTimeUpdate(newWhiteTime, blackTime);
        if (newWhiteTime === 0 && whiteTime > 0) {
          onFlagFall('w');
        }
      } else {
        const newBlackTime = Math.max(0, blackTime - delta);
        onTimeUpdate(whiteTime, newBlackTime);
        if (newBlackTime === 0 && blackTime > 0) {
          onFlagFall('b');
        }
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    lastTickRef.current = performance.now();
    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [activeColor, whiteTime, blackTime, paused, onTimeUpdate, onFlagFall]);

  const isWhiteLow = whiteTime <= 30000 && whiteTime > 0;
  const isBlackLow = blackTime <= 30000 && blackTime > 0;
  const isWhiteCritical = whiteTime <= 10000 && whiteTime > 0;
  const isBlackCritical = blackTime <= 10000 && blackTime > 0;

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[200px]">
      {/* Black Clock (top) */}
      <motion.div
        className={`relative w-full px-6 py-4 rounded-2xl font-mono text-2xl sm:text-3xl font-black tabular-nums transition-all duration-300 ${
          activeColor === 'b' ? 'ring-2' : ''
        }`}
        style={{
          backgroundColor: activeColor === 'b' ? 'rgba(245,184,61,0.15)' : 'var(--panel-bg)',
          borderColor: activeColor === 'b' ? 'var(--primary-accent)' : 'var(--glass-border)',
          color: isBlackCritical ? 'var(--danger)' : isBlackLow ? 'var(--primary-accent)' : 'var(--text-main)',
          boxShadow: isBlackCritical ? '0 0 30px rgba(251,113,133,0.4)' : activeColor === 'b' ? '0 0 20px rgba(245,184,61,0.2)' : 'none',
        }}
        animate={{
          scale: isBlackCritical ? [1, 1.02, 1] : 1,
        }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">
            {timeControl.incrementSeconds > 0 ? `+${timeControl.incrementSeconds}s` : 'Bullet'}
          </span>
          <span>{formatTimeLong(blackTime)}</span>
          {activeColor === 'b' && (
            <motion.div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: 'var(--primary-accent)', boxShadow: '0 0 10px var(--primary-accent)' }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>
      </motion.div>

      {/* White Clock (bottom) */}
      <motion.div
        className={`relative w-full px-6 py-4 rounded-2xl font-mono text-2xl sm:text-3xl font-black tabular-nums transition-all duration-300 ${
          activeColor === 'w' ? 'ring-2' : ''
        }`}
        style={{
          backgroundColor: activeColor === 'w' ? 'rgba(245,184,61,0.15)' : 'var(--panel-bg)',
          borderColor: activeColor === 'w' ? 'var(--primary-accent)' : 'var(--glass-border)',
          color: isWhiteCritical ? 'var(--danger)' : isWhiteLow ? 'var(--primary-accent)' : 'var(--text-main)',
          boxShadow: isWhiteCritical ? '0 0 30px rgba(251,113,133,0.4)' : activeColor === 'w' ? '0 0 20px rgba(245,184,61,0.2)' : 'none',
        }}
        animate={{
          scale: isWhiteCritical ? [1, 1.02, 1] : 1,
        }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <div className="flex items-center justify-between">
          {activeColor === 'w' && (
            <motion.div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: 'var(--primary-accent)', boxShadow: '0 0 10px var(--primary-accent)' }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
          <span>{formatTimeLong(whiteTime)}</span>
          <span className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">
            {timeControl.incrementSeconds > 0 ? `+${timeControl.incrementSeconds}s` : 'Bullet'}
          </span>
        </div>
      </motion.div>
    </div>
  );
};