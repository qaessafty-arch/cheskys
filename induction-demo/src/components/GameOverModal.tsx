import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Share2, Trophy, ArrowLeft, ChevronRight, X } from 'lucide-react';
import { GameState } from '../types/chess';
import { formatTimeLong } from '../utils/chessEngine';

interface GameOverModalProps {
  game: GameState;
  onRematch: () => void;
  onReview: () => void;
  onShare: () => void;
  onClose: () => void;
  accuracy?: number;
  bestMoves?: number;
  blunders?: number;
  mistakes?: number;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  game,
  onRematch,
  onReview,
  onShare,
  onClose,
  accuracy = 72,
  bestMoves = 5,
  blunders = 2,
  mistakes = 3,
}) => {
  const isWhiteWin = game.result === '1-0';
  const isBlackWin = game.result === '0-1';
  const isDraw = game.result === '1/2-1/2';

  const winner = isWhiteWin ? game.white : isBlackWin ? game.black : null;
  const loser = isWhiteWin ? game.black : isBlackWin ? game.white : null;

  const getResultText = () => {
    if (isDraw) return { title: 'DRAW', subtitle: 'Game drawn', color: 'var(--tertiary-accent)', icon: '½' };
    if (winner?.uid === 'demo-1') return { title: 'VICTORY', subtitle: 'You won!', color: 'var(--secondary-accent)', icon: '✦' };
    return { title: 'DEFEAT', subtitle: 'You lost', color: 'var(--danger)', icon: '✦' };
  };

  const result = getResultText();
  // Rating change shown from the player's side (demo-1 is the signed-in player); the opponent gets the opposite
  const userDelta = isDraw ? 0 : winner?.uid === 'demo-1' ? +12 : -10;
  const whiteDelta = game.white.uid === 'demo-1' ? userDelta : -userDelta;
  const blackDelta = -whiteDelta;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[var(--glass-border)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary-accent)]/5 to-transparent pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] text-[var(--text-muted)] transition-all border border-[var(--glass-border)] active:scale-95 flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Result */}
        <div className="text-center mb-8 relative z-10">
          <div
            className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center text-4xl font-black shadow-xl"
            style={{
              backgroundColor: `${result.color}20`,
              border: `2px solid ${result.color}`,
              color: result.color,
            }}
          >
            {result.icon}
          </div>
          <h2 id="game-over-title" className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-1" style={{ color: result.color }}>
            {result.title}
          </h2>
          <p className="text-[var(--text-muted)]">{result.subtitle}</p>
        </div>

        {/* Players */}
        <div className="flex items-center justify-between gap-4 mb-8 relative z-10">
          <div className={`flex-1 text-center p-4 rounded-2xl ${isWhiteWin ? 'bg-[var(--secondary-accent)]/10 border border-[var(--secondary-accent)]/30' : isBlackWin ? 'bg-[var(--danger)]/10 border border-[var(--danger)]/30' : 'bg-[var(--glass-bg)] border border-[var(--glass-border)]'}`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">{game.white.flag}</span>
              <span className="font-black text-[var(--text-main)] truncate max-w-[9rem]">{game.white.name}</span>
              {isWhiteWin && <Trophy className="w-5 h-5 text-[var(--secondary-accent)]" />}
            </div>
            <div className="text-[var(--primary-accent)] font-black text-lg">⚔️ {game.white.elo} <span className={whiteDelta >= 0 ? 'text-[var(--secondary-accent)]' : 'text-[var(--danger)]'}>({whiteDelta >= 0 ? '+' : ''}{whiteDelta})</span></div>
            <div className="text-[var(--text-dim)] text-xs mt-1">{game.timeControl.name}</div>
          </div>

          <div className="flex flex-col items-center justify-center px-4 text-[var(--text-muted)]">
            <span className="text-2xl font-black">VS</span>
            <span className="text-xs uppercase tracking-widest">{game.status}</span>
          </div>

          <div className={`flex-1 text-center p-4 rounded-2xl ${isBlackWin ? 'bg-[var(--secondary-accent)]/10 border border-[var(--secondary-accent)]/30' : isWhiteWin ? 'bg-[var(--danger)]/10 border border-[var(--danger)]/30' : 'bg-[var(--glass-bg)] border border-[var(--glass-border)]'}`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">{game.black.flag}</span>
              <span className="font-black text-[var(--text-main)] truncate max-w-[9rem]">{game.black.name}</span>
              {isBlackWin && <Trophy className="w-5 h-5 text-[var(--secondary-accent)]" />}
            </div>
            <div className="text-[var(--primary-accent)] font-black text-lg">⚔️ {game.black.elo} <span className={blackDelta >= 0 ? 'text-[var(--secondary-accent)]' : 'text-[var(--danger)]'}>({blackDelta >= 0 ? '+' : ''}{blackDelta})</span></div>
            <div className="text-[var(--text-dim)] text-xs mt-1">{game.timeControl.name}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-8 relative z-10">
          <StatCard label="Accuracy" value={`${accuracy}%`} icon="🎯" />
          <StatCard label="Best Moves" value={bestMoves} icon="✨" />
          <StatCard label="Blunders" value={blunders} icon="💥" color="var(--danger)" />
          <StatCard label="Mistakes" value={mistakes} icon="⚠️" color="var(--primary-accent)" />
        </div>

        {/* Time used */}
        <div className="flex items-center justify-center gap-8 mb-8 relative z-10 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">Time Used</div>
            <div className="text-xl font-mono font-black text-[var(--text-main)]">{formatTimeLong(game.whiteTime)}</div>
          </div>
          <div className="w-px h-8 bg-[var(--glass-border)]" />
          <div>
            <div className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">Moves</div>
            <div className="text-xl font-mono font-black text-[var(--text-main)]">{game.moves.length}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 relative z-10">
          <button
            onClick={onReview}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <ChevronRight className="w-4 h-4" />
            Review Game
          </button>
          <button
            onClick={onRematch}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Play Again
          </button>
          <button
            onClick={onShare}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share Result
          </button>
          <button
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text-main)] text-sm font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: string; color?: string }> = ({
  label,
  value,
  icon,
  color,
}) => (
  <div className="glass-panel p-3 text-center">
    <div className="text-xl mb-1">{icon}</div>
    <div className="text-xl font-black text-[var(--text-main)]" style={{ color: color }}>{value}</div>
    <div className="text-[9px] uppercase tracking-widest font-black text-[var(--text-muted)]">{label}</div>
  </div>
);