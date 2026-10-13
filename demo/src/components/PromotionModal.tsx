import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { PieceType } from '../types/chess';

interface PromotionModalProps {
  square: string;
  color: 'w' | 'b';
  onPromote: (piece: PieceType) => void;
  onCancel: () => void;
  autoQueenTimer?: number;
}

const PROMOTION_PIECES: Array<{ type: PieceType; label: string; symbol: { w: string; b: string } }> = [
  { type: 'q', label: 'Queen', symbol: { w: '♕', b: '♛' } },
  { type: 'r', label: 'Rook', symbol: { w: '♖', b: '♜' } },
  { type: 'b', label: 'Bishop', symbol: { w: '♗', b: '♝' } },
  { type: 'n', label: 'Knight', symbol: { w: '♘', b: '♞' } },
];

export const PromotionModal: React.FC<PromotionModalProps> = ({
  square,
  color,
  onPromote,
  onCancel,
  autoQueenTimer = 5000,
}) => {
  const [timeLeft, setTimeLeft] = useState(autoQueenTimer);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          onPromote('q'); // Auto-queen
          return 0;
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [onPromote]);

  const progress = (timeLeft / autoQueenTimer) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Pawn promotion"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="glass-panel rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-[var(--glass-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="mb-6 h-1.5 bg-[var(--glass-bg)] rounded-full overflow-hidden">
          <motion.div
            className="h-full"
            style={{
              backgroundColor: 'var(--primary-accent)',
              width: `${progress}%`,
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: autoQueenTimer / 1000, ease: 'linear' }}
          />
        </div>

        <h3 className="text-xl font-black text-center mb-2 text-[var(--text-main)]">Pawn Promotion</h3>
        <p className="text-center text-[var(--text-dim)] text-sm mb-6">
          Choose a piece for your pawn on {square.toUpperCase()}
        </p>

        <div className="grid grid-cols-4 gap-3">
          {PROMOTION_PIECES.map((piece) => (
            <button
              key={piece.type}
              onClick={() => onPromote(piece.type)}
              className="relative aspect-square rounded-2xl glass-panel-hover flex flex-col items-center justify-center transition-all"
              style={{
                fontSize: 'clamp(32px, 8vw, 48px)',
                lineHeight: 1,
                color: color === 'w' ? 'var(--square-dark-text)' : 'var(--square-light-text)',
              }}
              aria-label={`Promote to ${piece.label}`}
            >
              {piece.symbol[color]}
              <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] mt-1">
                {piece.label}
              </span>
            </button>
          ))}
        </div>

        <p className="text-center text-[11px] text-[var(--text-dim)] mt-4">
          Auto-queen in {Math.ceil(timeLeft / 1000)}s
        </p>
      </motion.div>
    </motion.div>
  );
};