import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, AlertCircle } from 'lucide-react';
import { TimeControl } from '../types/chess';
import { DEMO_TIME_CONTROLS } from '../data/demoData';
import { useDemo } from '../context/DemoContext';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (code: string, timeControl: TimeControl) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ isOpen, onClose, onJoin }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>(DEMO_TIME_CONTROLS[2]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length !== 6) {
      setError('Please enter a valid 6-character code');
      return;
    }
    setError(null);
    onJoin(cleanCode, selectedTimeControl);
    onClose();
    setCode('');
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Join game room"
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

        <h2 className="text-2xl font-black text-[var(--text-main)] mb-2 text-center">Join Game Room</h2>
        <p className="text-center text-[var(--text-muted)] mb-8">Enter the 6-character code from your friend</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Code Input */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Room Code</label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC123"
                maxLength={6}
                className="w-full px-6 py-4 text-center text-2xl font-mono font-black tracking-widest bg-[var(--app-bg)] border-2 rounded-xl text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none transition-all"
                style={{
                  borderColor: error ? 'var(--danger)' : 'var(--glass-border)',
                  letterSpacing: '0.3em',
                }}
                autoFocus
                aria-label="Room code"
                aria-invalid={!!error}
              />
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--danger)]"
                >
                  <AlertCircle className="w-5 h-5" />
                </motion.div>
              )}
              {!error && code.length === 6 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--secondary-accent)]"
                >
                  <Check className="w-5 h-5" />
                </motion.div>
              )}
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[var(--danger)] text-sm text-center mt-2"
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Time Control */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Time Control</label>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_TIME_CONTROLS.map((tc) => (
                <button
                  key={tc.id}
                  type="button"
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

          {/* Join Button */}
          <button
            type="submit"
            disabled={code.length !== 6}
            className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-5 h-5 mr-2" />
            Join Room
          </button>
        </form>

        <p className="text-center text-[11px] text-[var(--text-dim)] mt-4">
          Bot opponent will be the host for demo
        </p>
      </motion.div>
    </motion.div>
  );
};