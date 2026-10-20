import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameResult } from '../types/chess';
import { Trophy, RefreshCw, Compass, Award, X, GraduationCap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AiMangaRecap } from './AiMangaRecap';

interface GameOverModalProps {
  result: GameResult;
  onRematch: () => void;
  onNewGame: () => void;
  onAnalyze: () => void;
  onPracticePuzzles?: () => void;
  onReviewWithCoach?: () => void;
  onClose: () => void;
  pgn?: string;
  rematchState?: 'none' | 'offered_by_me' | 'offered_by_opponent';
  onAcceptRematch?: () => void;
  // Set only for rated online games, from the server's authoritative result.
  ratingChange?: { delta: number; after: number } | null;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  result,
  ratingChange,
  onRematch,
  onNewGame,
  onAnalyze,
  onPracticePuzzles,
  onReviewWithCoach,
  onClose,
  pgn,
  rematchState = 'none',
  onAcceptRematch
}) => {
  const isWhiteWin = result.winner === 'w';
  const isBlackWin = result.winner === 'b';
  const isDraw = result.winner === 'draw';

  useEffect(() => {
    if (result.winner && result.winner !== 'draw') {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6']
        });
      } catch {
        // Confetti optional
      }
    }
  }, [result.winner]);

  const title = isDraw
    ? 'Game Drawn'
    : isWhiteWin
    ? 'White Wins!'
    : 'Black Wins!';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative obsidian-panel rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center border-[#1F293D]"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-white p-1.5 rounded-xl hover:bg-[#1F293D] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Victory Icon */}
        <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#0B0F19] border flex items-center justify-center shadow-2xl transition-all ${
          isWhiteWin || isBlackWin 
            ? 'border-[#F59E0B] text-[#F59E0B] shadow-[#F59E0B]/20' 
            : 'border-[#1F293D] text-[#94A3B8]'
        }`}>
          {isDraw ? <Award className="w-10 h-10" /> : <Trophy className="w-10 h-10" />}
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight uppercase">
          {title}
        </h2>
        <p className="text-xs font-black text-[#94A3B8] uppercase tracking-[0.2em] mb-4 opacity-80">
          <span className="font-mono text-white mr-2">{isWhiteWin ? '1-0' : isBlackWin ? '0-1' : '½-½'}</span>
          {result.reason}
        </p>
        {ratingChange && (
          <p className="text-sm font-black font-mono text-white mb-8" data-testid="rating-change">
            Rating {ratingChange.after}{' '}
            <span className={ratingChange.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              ({ratingChange.delta >= 0 ? '+' : ''}{ratingChange.delta})
            </span>
          </p>
        )}
        {!ratingChange && <div className="mb-8" />}
        {/* Action Buttons */}
        <div className="space-y-3">

          {rematchState === "offered_by_opponent" ? (
            <button
              onClick={onAcceptRematch || onRematch}
              className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-emerald-500 text-white font-black text-sm transition-all shadow-xl shadow-emerald-500/20 active:scale-95 cursor-pointer uppercase tracking-widest animate-pulse"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Accept Rematch</span>
            </button>
          ) : rematchState === "offered_by_me" ? (
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-[#F59E0B]/50 text-[#0B0F19]/50 font-black text-sm transition-all shadow-xl shadow-[#F59E0B]/10 cursor-not-allowed uppercase tracking-widest"
            >
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Waiting...</span>
            </button>
          ) : (
            <button
              onClick={onRematch}
              className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-[#F59E0B] text-[#0B0F19] font-black text-sm transition-all shadow-xl shadow-[#F59E0B]/20 active:scale-95 cursor-pointer uppercase tracking-widest"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Rematch</span>
            </button>
          )}

          {onReviewWithCoach && (
            <button
              onClick={onReviewWithCoach}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-500 text-[#0B0F19] font-black text-[11px] hover:brightness-110 transition-all uppercase tracking-widest active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Review with Coach</span>
            </button>
          )}

          <button
            onClick={onNewGame}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#111827] text-white font-black text-[11px] hover:bg-[#1F293D] border border-[#1F293D] transition-all uppercase tracking-widest active:scale-95 cursor-pointer"
          >
            <span>Change Opponent</span>
          </button>

          {onPracticePuzzles && (
            <button
              onClick={onPracticePuzzles}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#0B0F19] text-[#94A3B8] font-black text-[11px] hover:text-emerald-300 hover:border-emerald-500/40 border border-[#1F293D] transition-all uppercase tracking-widest active:scale-95 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Practice Puzzles</span>
            </button>
          )}
          <button
            onClick={onAnalyze}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#0B0F19] text-[#94A3B8] font-black text-[11px] hover:text-[#F59E0B] hover:border-[#F59E0B]/30 border border-[#1F293D] transition-all uppercase tracking-widest active:scale-95 cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>Analyze Game</span>
          </button>
        </div>

        {pgn && (
          <div className="mt-8 pt-8 border-t border-[#1F293D]">
            <AiMangaRecap pgn={pgn} />
          </div>
        )}
      </motion.div>
    </div>
  );
};
