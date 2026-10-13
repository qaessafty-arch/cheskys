import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Search, User, Clock, Zap, Shield } from 'lucide-react';
import { TimeControl, Player } from '../types/chess';
import { DEMO_TIME_CONTROLS, DEMO_BOT_CONFIG } from '../data/demoData';
import { useDemo } from '../context/DemoContext';

interface MatchmakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (timeControl: TimeControl, difficulty: 'easy' | 'medium' | 'hard') => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({ isOpen, onClose, onStart }) => {
  const { startQuickMatch, matchmakingState, matchmakingOpponent, settings } = useDemo();
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>(DEMO_TIME_CONTROLS[2]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>(settings.difficulty);
  const [searchTime, setSearchTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (matchmakingState === 'searching') {
      interval = setInterval(() => setSearchTime(t => t + 1), 1000);
    } else {
      setSearchTime(0);
    }
    return () => clearInterval(interval);
  }, [matchmakingState]);

  useEffect(() => {
    if (matchmakingState === 'found' && matchmakingOpponent) {
      // Modal will close automatically when game starts
    }
  }, [matchmakingState, matchmakingOpponent]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={matchmakingState === 'idle' ? onClose : () => {}}
      role="dialog"
      aria-modal="true"
      aria-label="Matchmaking"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative glass-panel rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[var(--glass-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={matchmakingState === 'idle' ? onClose : () => {}}
          disabled={matchmakingState !== 'idle'}
          className="absolute top-4 right-4 w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {matchmakingState === 'idle' ? (
          // Setup phase
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--primary-accent)]/20 flex items-center justify-center">
              <Zap className="w-10 h-10 text-[var(--primary-accent)]" />
            </div>
            <h2 className="text-2xl font-black text-[var(--text-main)] mb-2">Quick Match</h2>
            <p className="text-[var(--text-muted)] mb-8">Find an opponent instantly</p>

            {/* Time Control */}
            <div className="mb-6 text-left">
              <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">Time Control</label>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_TIME_CONTROLS.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => setSelectedTimeControl(tc)}
                    className={`py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                      selectedTimeControl.id === tc.id
                        ? 'bg-[var(--primary-accent)] text-[var(--app-bg)] shadow-[0_0_20px_rgba(245,184,61,0.3)]'
                        : 'glass-panel-hover text-[var(--text-main)]'
                    }`}
                  >
                    <div className="font-black">{tc.name}</div>
                    <div className="text-[11px] opacity-70">{tc.incrementSeconds > 0 ? `+${tc.incrementSeconds}s inc` : 'No increment'}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="mb-8 text-left">
              <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">Bot Difficulty</label>
              <div className="space-y-2">
                {(['easy', 'medium', 'hard'] as const).map((diff) => {
                  const config = DEMO_BOT_CONFIG[diff];
                  return (
                    <button
                      key={diff}
                      onClick={() => setSelectedDifficulty(diff)}
                      className={`w-full p-4 rounded-xl text-left transition-all ${
                        selectedDifficulty === diff
                          ? 'bg-[var(--primary-accent)]/10 border border-[var(--primary-accent)]/30'
                          : 'glass-panel-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-black text-[var(--text-main)]">{config.name}</div>
                          <div className="text-[11px] text-[var(--text-dim)]">Rating: {config.rating} • {config.strategy.replace('_', ' ')}</div>
                        </div>
                        <span className="text-[11px] font-bold text-[var(--text-dim)]">{config.moveDelay}ms/move</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => onStart(selectedTimeControl, selectedDifficulty)}
              className="btn-primary w-full py-4 text-lg"
              disabled={matchmakingState !== 'idle'}
            >
              <Search className="w-5 h-5 mr-2" />
              Find Match
            </button>
          </div>
        ) : matchmakingState === 'searching' ? (
          // Searching phase
          <div className="text-center">
            <motion.div
              className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-[var(--glass-border)] border-t-[var(--primary-accent)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <h2 className="text-2xl font-black text-[var(--text-main)] mb-2">Searching for Opponent</h2>
            <p className="text-[var(--text-muted)] mb-2">Finding a worthy opponent...</p>
            <div className="text-3xl font-mono font-black text-[var(--primary-accent)] mb-6">{formatTime(searchTime)}</div>

            <div className="glass-panel p-4 rounded-xl mb-6">
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Clock className="w-4 h-4" />
                  <span>{selectedTimeControl.name}</span>
                </div>
                <div className="w-px h-6 bg-[var(--glass-border)]" />
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <User className="w-4 h-4" />
                  <span>{DEMO_BOT_CONFIG[selectedDifficulty].name}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => { startQuickMatch(selectedTimeControl, selectedDifficulty); }} // This will cancel
              className="btn-danger w-full"
            >
              <X className="w-5 h-5 mr-2" />
              Cancel Search
            </button>
          </div>
        ) : matchmakingState === 'found' && matchmakingOpponent ? (
          // Match found phase
          <div className="text-center">
            <motion.div
              className="w-24 h-24 mx-auto mb-6 rounded-full bg-[var(--secondary-accent)]/20 flex items-center justify-center"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Shield className="w-12 h-12 text-[var(--secondary-accent)]" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-black text-[var(--secondary-accent)] mb-2"
            >
              Match Found!
            </motion.h2>
            <p className="text-[var(--text-muted)] mb-8">Preparing game...</p>

            <div className="flex items-center justify-center gap-8 mb-8">
              <PlayerCard player={matchmakingOpponent} label="Opponent" />
              <div className="text-[var(--primary-accent)] font-black text-2xl">VS</div>
              <PlayerCard player={{ uid: 'demo-1', name: 'You', elo: 1428, country: 'IQ', flag: '🇮🇶', avatar: 'ukh', online: true }} label="You" />
            </div>

            <div className="glass-panel p-4 rounded-xl">
              <div className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">{selectedTimeControl.name}</div>
              <div className="text-[var(--text-main)] font-mono text-xl">{selectedTimeControl.initialMinutes}+{selectedTimeControl.incrementSeconds}</div>
            </div>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
};

const PlayerCard: React.FC<{ player: Player; label: string }> = ({ player, label }) => (
  <div className="text-center">
    <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center text-3xl">{player.flag}</div>
    <div className="font-black text-[var(--text-main)]">{player.name}</div>
    <div className="text-[var(--primary-accent)] font-mono text-sm">⚔️ {player.elo}</div>
    <div className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] mt-1">{label}</div>
  </div>
);