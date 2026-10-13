import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Heart, Shield, X, Zap, Crown, Flag } from 'lucide-react';

interface ExecuteSpareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: () => void;
  onSpare: () => void;
  opponentName: string;
  executeEloGain?: number;
  executeHonorGain?: number;
  spareHonorGain?: number;
}

export const ExecuteSpareModal: React.FC<ExecuteSpareModalProps> = ({
  isOpen,
  onClose,
  onExecute,
  onSpare,
  opponentName,
  executeEloGain = 12,
  executeHonorGain = 25,
  spareHonorGain = 8,
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="execute-spare-title"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative glass-panel rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[var(--glass-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 relative z-10">
          <motion.div
            className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-xl"
            style={{ backgroundColor: 'rgba(245,184,61,0.15)', border: '2px solid var(--primary-accent)' }}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Zap className="w-10 h-10 text-[var(--primary-accent)]" />
          </motion.div>

          <h2 id="execute-spare-title" className="text-2xl font-black text-[var(--text-main)] mb-1">Critical Decision</h2>
          <p className="text-[var(--text-muted)] text-sm">
            The game approaches its climax. Your honor hangs in the balance.
          </p>
        </div>

        {/* Opponent Info */}
        <div className="glass-panel p-4 rounded-xl mb-6 relative z-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-2 text-[var(--secondary-accent)]">
              <Crown className="w-5 h-5" />
              <span className="font-bold text-sm">HONOR AT STAKE</span>
            </div>
            <div className="w-px h-6 bg-[var(--glass-border)]" />
            <div className="flex items-center gap-2 text-[var(--primary-accent)]">
              <Flag className="w-5 h-5" />
              <span className="font-bold text-sm">ELO IMPACT</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8 text-center">
            <div>
              <div className="text-3xl font-black text-[var(--secondary-accent)]">⚔️</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Opponent</div>
              <div className="font-bold text-[var(--text-main)]">{opponentName}</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">vs</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">You</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-[var(--primary-accent)]">🏰</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Chancellor</div>
              <div className="font-bold text-[var(--text-main)]">You</div>
            </div>
          </div>
        </div>

        {/* Execute Option */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={onExecute}
          className="w-full relative overflow-hidden rounded-2xl mb-4 group"
          style={{
            background: 'linear-gradient(135deg, rgba(251,113,133,0.2), rgba(245,184,61,0.2))',
            border: '2px solid var(--danger)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--danger)]/10 to-[var(--primary-accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(251,113,133,0.2)' }}>
              <Sparkles className="w-7 h-7 text-[var(--danger)]" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[var(--danger)]/20 text-[var(--danger)]">EXECUTE</span>
                <Zap className="w-4 h-4 text-[var(--danger)]" />
              </div>
              <h3 className="font-black text-[var(--text-main)]">Deliver the Final Blow</h3>
              <p className="text-[var(--text-dim)] text-sm mt-1">Claim decisive victory and full honors</p>
              <div className="flex flex-wrap gap-3 mt-3 text-sm">
                <span className="flex items-center gap-1 text-[var(--primary-accent)] font-bold">
                  <Flag className="w-3 h-3" />
                  ELO: +{12}
                </span>
                <span className="flex items-center gap-1 text-[var(--secondary-accent)] font-bold">
                  <Heart className="w-3 h-3" />
                  Honor: +{25}
                </span>
                <span className="flex items-center gap-1 text-[var(--danger)] font-bold">
                  <Shield className="w-3 h-3" />
                  Opponent: -10 ELO
                </span>
              </div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-[var(--danger)] group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ background: 'linear-gradient(90deg, var(--danger), var(--primary-accent))' }}
            animate={{ scaleX: [0, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.button>

        {/* Spare Option */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={onSpare}
          className="w-full relative overflow-hidden rounded-2xl mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(110,231,183,0.15), rgba(96,165,250,0.15))',
            border: '2px solid var(--secondary-accent)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--secondary-accent)]/10 to-[var(--tertiary-accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(110,231,183,0.2)' }}>
              <Shield className="w-7 h-7 text-[var(--secondary-accent)]" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[var(--secondary-accent)]/20 text-[var(--secondary-accent)]">SPARE</span>
                <Heart className="w-4 h-4 text-[var(--secondary-accent)]" />
              </div>
              <h3 className="font-black text-[var(--text-main)]">Show Mercy & Honor</h3>
              <p className="text-[var(--text-dim)] text-sm mt-1">Offer honorable draw, preserve mutual respect</p>
              <div className="flex flex-wrap gap-3 mt-3 text-sm">
                <span className="flex items-center gap-1 text-[var(--tertiary-accent)] font-bold">
                  <Flag className="w-3 h-3" />
                  ELO: +0 (Draw)
                </span>
                <span className="flex items-center gap-1 text-[var(--secondary-accent)] font-bold">
                  <Heart className="w-3 h-3" />
                  Honor: +{8} (Mercy)
                </span>
                <span className="flex items-center gap-1 text-[var(--secondary-accent)] font-bold">
                  <Shield className="w-3 h-3" />
                  Opponent: +2 Honor
                </span>
              </div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-[var(--secondary-accent)]">
              <Heart className="w-5 h-5" />
            </div>
          </div>
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ background: 'linear-gradient(90deg, var(--secondary-accent), var(--tertiary-accent))' }}
            animate={{ scaleX: [0, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-[11px] text-[var(--text-dim)] mt-4"
        >
          "True strength lies not in the blade, but in the wisdom to sheathe it."
        </motion.p>
      </motion.div>
    </motion.div>
  );
};

export default ExecuteSpareModal;