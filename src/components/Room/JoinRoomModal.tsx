import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';
import { toast } from 'sonner';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ isOpen, onClose }) => {
  const { joinRoomWithContext } = useRoom();
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      setError('Please enter a valid 6-character room code.');
      return;
    }

    setIsJoining(true);
    setError(null);
    try {
      await joinRoomWithContext(cleanCode);
      toast.success('Connected to the Astral Sanctum!');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Match room not found or already full.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md glass-panel p-8 rounded-3xl border border-[#F5C453]/40 shadow-2xl z-10"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2 mb-8">
              <h3 className="text-2xl font-black text-white uppercase tracking-wider">
                Summon via Code
              </h3>
              <p className="text-xs text-white/60">
                Enter the 6-character astral code provided by the host.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  placeholder="e.g. XJ2P9S"
                  className="w-full px-4 py-4 rounded-2xl bg-black/60 border-2 border-[#F5C453]/40 text-white font-mono text-center text-2xl font-black tracking-[0.25em] focus:border-[#F5C453] focus:outline-none transition-all placeholder:text-white/20"
                  autoFocus
                />
                {error && (
                  <div className="flex items-center gap-2 text-rose-400 text-[11px] font-bold justify-center">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#8C2425] via-[#52673A] to-[#F5C453] hover:brightness-110 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#F5C453]/20 border border-[#F5C453]/50 transition-all cursor-pointer"
              >
                {isJoining ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>{isJoining ? 'Connecting...' : 'Ascend & Begin Trial'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
