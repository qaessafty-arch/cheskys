import React from 'react';
import { motion } from 'motion/react';
import { Swords, Clock, Check, X, Shield, Sparkles } from 'lucide-react';
import { normalizeRoomCode } from '../utils/roomResolver';

export interface InviteCardProps {
  inviteId: string;
  roomCode: string;
  challengerName: string;
  challengerAvatar?: string;
  challengerElo?: number;
  timeControl?: string;
  rated?: boolean;
  gameId?: string;
  onAccept?: (inviteId: string, roomCode: string) => void;
  onDecline?: (inviteId: string) => void;
}

export const InviteCard: React.FC<InviteCardProps> = ({
  inviteId, roomCode, challengerName, challengerAvatar, challengerElo = 1200, timeControl = '10+0 Rapid', rated = true, gameId, onAccept, onDecline,
}) => {
  const normalizedCode = normalizeRoomCode(roomCode);

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();

    // FIX: Bundle all metadata into a structured invite object for the resolver
    const invitePayload = {
      inviteId,
      roomCode: normalizedCode,
      invitedBy: challengerName,
      invitedByName: challengerName,
      settings: {
        timeControlName: timeControl,
        rated: rated,
        initialSeconds: timeControl.includes('10') ? 600 : 300,
        incrementSeconds: 0,
        color: 'random',
      }
    };

    window.dispatchEvent(
      new CustomEvent('accept-challenge', {
        detail: { invite: invitePayload, roomCode: normalizedCode, matchId: gameId || normalizedCode },
      })
    );

    window.dispatchEvent(
      new CustomEvent('room_invite_response', {
        detail: { status: 'accepted', inviteId, roomCode: normalizedCode },
      })
    );

    onAccept?.(inviteId, normalizedCode);
  };

  const handleDecline = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('room_invite_response', { detail: { status: 'declined', inviteId, roomCode: normalizedCode } }));
    onDecline?.(inviteId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      className="p-4 rounded-2xl border border-[#F5C453]/40 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] shadow-2xl backdrop-blur-xl flex flex-col gap-3.5 w-full max-w-sm text-left transition-all hover:border-[#F5C453]/60"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <img src={challengerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'} alt={challengerName} className="w-12 h-12 rounded-xl object-cover border-2 border-[#F5C453]" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#F5C453] text-black flex items-center justify-center shadow"><Swords className="w-3 h-3 text-black" /></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white truncate">{challengerName}</h4>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5C453]/15 text-[#F5C453] border border-[#F5C453]/30">{challengerElo}</span>
          </div>
          <p className="text-xs text-white/60 flex items-center gap-1 mt-0.5 font-medium"><Sparkles className="w-3 h-3 text-[#F5C453]" /><span>Private Room Challenge</span></p>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-white/80"><Clock className="w-3.5 h-3.5 text-[#F5C453]" /><span>{timeControl}</span></div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-black text-[#F5C453] tracking-wider px-2 py-0.5 rounded bg-[#F5C453]/10 border border-[#F5C453]/20">{normalizedCode}</span>
          <span className="flex items-center gap-1 text-emerald-400"><Shield className="w-3 h-3" />{rated ? 'Rated' : 'Casual'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={handleAccept} className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#F5C453] to-[#E5B544] text-black text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"><Check className="w-4 h-4 stroke-[3]" />Accept</button>
        <button onClick={handleDecline} className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"><X className="w-4 h-4" />Decline</button>
      </div>
    </motion.div>
  );
};
export default InviteCard;
