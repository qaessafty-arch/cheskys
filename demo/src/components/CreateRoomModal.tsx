import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Copy, Check, RefreshCw, Globe, Lock, Shield, Zap } from 'lucide-react';
import { TimeControl } from '../types/chess';
import { DEMO_TIME_CONTROLS } from '../data/demoData';
import { generateGameRoomCode } from '../utils/chessEngine';
import { useDemo } from '../context/DemoContext';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (timeControl: TimeControl, side: 'white' | 'black' | 'random', rated: boolean) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose, onCreate }) => {
  const { createdRoomCode, settings } = useDemo();
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>(DEMO_TIME_CONTROLS[2]);
  const [selectedSide, setSelectedSide] = useState<'white' | 'black' | 'random'>('random');
  const [rated, setRated] = useState(true);
  const [copied, setCopied] = useState(false);
  const [roomCode, setRoomCode] = useState(() => generateGameRoomCode());

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
      aria-label="Create game room"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="relative glass-panel rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[var(--glass-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-black text-[var(--text-main)] mb-2 text-center">Create Game Room</h2>
        <p className="text-center text-[var(--text-muted)] mb-8">Share the code with a friend to play</p>

        {/* Room Code */}
        <div className="mb-8 p-4 glass-panel rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Room Code</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-10 h-10 rounded-lg glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"
              aria-label="Copy room code"
            >
              {copied ? <Check className="w-5 h-5 text-[var(--secondary-accent)]" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 text-3xl font-mono font-black tracking-widest text-[var(--text-main)]" style={{ letterSpacing: '0.3em' }}>
            {roomCode.split('').map((char, i) => (
              <span key={i} className="w-12 h-12 rounded-lg flex items-center justify-center select-none" style={{ backgroundColor: 'var(--glass-bg)' }}>
                {char}
              </span>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-3">
            <button
              onClick={() => setRoomCode(generateGameRoomCode())}
              className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider glass-panel-hover rounded-lg"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              New Code
            </button>
            <span className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider glass-panel rounded-lg text-[var(--text-dim)]">
              5 min expiry
            </span>
          </div>
        </div>

        {/* Time Control */}
        <div className="mb-6">
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

        {/* Color Preference */}
        <div className="mb-6">
          <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">Your Color</label>
          <div className="grid grid-cols-3 gap-2">
            {(['white', 'black', 'random'] as const).map((side) => (
              <button
                key={side}
                onClick={() => setSelectedSide(side)}
                className={`py-3 rounded-xl font-bold transition-all ${
                  selectedSide === side
                    ? 'bg-[var(--primary-accent)] text-[var(--app-bg)]'
                    : 'glass-panel-hover text-[var(--text-main)]'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-3 h-3 rounded ${side === 'white' ? 'bg-white' : side === 'black' ? 'bg-black' : 'bg-gradient-to-r from-white to-black'}`} />
                  <span className="capitalize">{side}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Rated Toggle */}
        <div className="mb-8 glass-panel p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center">
              {rated ? <Shield className="w-5 h-5 text-[var(--primary-accent)]" /> : <Globe className="w-5 h-5 text-[var(--text-muted)]" />}
            </div>
            <div>
              <div className="font-bold text-[var(--text-main)]">{rated ? 'Rated Game' : 'Casual Game'}</div>
              <div className="text-[11px] text-[var(--text-dim)]">{rated ? 'Affects your rating' : 'No rating change'}</div>
            </div>
          </div>
          <button
            onClick={() => setRated(!rated)}
            className={`relative w-14 h-8 rounded-full flex items-center transition-all ${
              rated ? 'bg-[var(--primary-accent)]' : 'bg-[var(--glass-bg)] border border-[var(--glass-border)]'
            }`}
            aria-label={rated ? 'Make casual' : 'Make rated'}
          >
            <span
              className={`absolute w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                rated ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Create Button */}
        <button
          onClick={() => {
            onCreate(selectedTimeControl, selectedSide, rated);
            onClose();
          }}
          className="btn-primary w-full py-4 text-lg"
        >
          <Zap className="w-5 h-5 mr-2" />
          Create Room
        </button>

        <p className="text-center text-[11px] text-[var(--text-dim)] mt-4">
          Bot opponent will join automatically for demo
        </p>
      </motion.div>
    </motion.div>
  );
};