import React from 'react';
import { motion } from 'motion/react';
import { Shield, Sword, HeartHandshake, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CheckmateJudgmentModalProps {
  onExecute: () => void;
  onMercy: () => void;
  onClose: () => void;
  /** Set for a two-player game on one device, where neither side is "you". */
  winnerName?: string;
  opponentName?: string;
  /** Rating change for taking the win, or null when the game is unrated. */
  eloGain?: number | null;
}

export const CheckmateJudgmentModal: React.FC<CheckmateJudgmentModalProps> = ({
  onExecute,
  onMercy,
  onClose,
  winnerName,
  opponentName = 'Opponent',
  eloGain = null
}) => {
  const triggerConfetti = (colors: string[]) => {
    try {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors
      });
    } catch {
      // Confetti fallback
    }
  };

  const handleExecuteClick = () => {
    triggerConfetti(['#EF4444', '#F59E0B', '#0B0F19']);
    onExecute();
  };

  const handleMercyClick = () => {
    triggerConfetti(['#F59E0B', '#10B981', '#3B82F6']);
    onMercy();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative obsidian-panel rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-[#1F293D] text-center overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-white p-1.5 rounded-xl hover:bg-[#1F293D] transition-colors z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tactical Emblem */}
        <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#F59E0B]/10 animate-pulse blur-xl" />
          <div className="relative w-16 h-16 rounded-2xl bg-[#0B0F19] border border-[#F59E0B] flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.2)]">
            <Shield className="w-8 h-8 text-[#F59E0B]" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-black uppercase tracking-widest mb-4">
          <span>⚔️ Checkmate!</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2 uppercase">
          {winnerName ? `${winnerName} wins. Choose an ending` : 'You won. Choose an ending'}
        </h2>
        <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-[0.2em] mb-8 opacity-70 max-w-sm mx-auto leading-relaxed">
          <strong className="text-white">{opponentName}</strong> is checkmated. Take the win, or take back the mating move and play on.
        </p>

        {/* Dual Choice Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
          {/* Choice 1: EXECUTE */}
          <button
            type="button"
            onClick={handleExecuteClick}
            className="group relative p-5 rounded-2xl bg-[#0B0F19] border border-[#EF4444]/30 hover:border-[#EF4444] flex-col items-start transition-all active:scale-95 shadow-lg flex justify-between cursor-pointer"
          >
            <div className="w-full text-left">
              <div className="flex items-center justify-between mb-4">
                <span className="p-2 rounded-xl bg-[#EF4444] text-white shadow-lg">
                  <Sword className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-black text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded-lg border border-[#EF4444]/20">
                  {eloGain !== null ? 'RATED WIN' : 'WIN'}
                </span>
              </div>
              <h3 className="font-black text-xs text-white group-hover:text-[#EF4444] transition-colors uppercase tracking-wider">
                Execute
              </h3>
              <p className="text-[10px] font-black text-[#94A3B8] mt-1 leading-normal uppercase opacity-60">
                End the game as a win by checkmate.
              </p>
            </div>
            <div className="w-full mt-4 pt-3 border-t border-[#1F293D] flex items-center justify-between text-[10px] font-black uppercase tracking-tighter">
              <span className="text-[#94A3B8]">Reward</span>
              <span className="text-[#EF4444]">{eloGain !== null ? `${eloGain >= 0 ? '+' : ''}${eloGain} Elo` : 'Unrated'}</span>
            </div>
          </button>

          {/* Choice 2: MERCY */}
          <button
            type="button"
            onClick={handleMercyClick}
            className="group relative p-5 rounded-2xl bg-[#0B0F19] border border-[#10B981]/30 hover:border-[#10B981] flex-col items-start transition-all active:scale-95 shadow-lg flex justify-between cursor-pointer"
          >
            <div className="w-full text-left">
              <div className="flex items-center justify-between mb-4">
                <span className="p-2 rounded-xl bg-[#10B981] text-white shadow-lg">
                  <HeartHandshake className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-black text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-lg border border-[#10B981]/20">
                  MORE RESPECT
                </span>
              </div>
              <h3 className="font-black text-xs text-white group-hover:text-[#10B981] transition-colors uppercase tracking-wider">
                Show Mercy
              </h3>
              <p className="text-[10px] font-black text-[#94A3B8] mt-1 leading-normal uppercase opacity-60">
                Take back the mating move and keep playing.
              </p>
            </div>
            <div className="w-full mt-4 pt-3 border-t border-[#1F293D] flex items-center justify-between text-[10px] font-black uppercase tracking-tighter">
              <span className="text-[#94A3B8]">Bonus</span>
              <span className="text-[#F59E0B]">+12 Respect</span>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
