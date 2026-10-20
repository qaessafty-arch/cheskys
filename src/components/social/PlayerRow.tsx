import React, { useState } from 'react';
import { Check, Clock, MessageSquare, UserPlus, X } from 'lucide-react';
import { FriendUser } from '../../types/chess';
import { Relation, SocialGraph } from '../../hooks/useSocialGraph';
import { cancelFriendRequest, requestIdFor, respondToFriendRequest, sendFriendRequest, unblockUser } from '../../services/friendService';
import { useAuth } from '../../context/AuthContext';

export const PlayerAvatar: React.FC<{ player: Pick<FriendUser, 'displayName' | 'photoURL' | 'isOnline'>; size?: number; showStatus?: boolean }> = ({ player, size = 40, showStatus = true }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {player.photoURL && !broken ? (
        <img src={player.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="w-full h-full rounded-xl object-cover border border-white/10" />
      ) : (
        <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#52673A] to-[#8C2425] flex items-center justify-center font-black text-white" style={{ fontSize: size * 0.42 }}>
          {(player.displayName || '?').charAt(0).toUpperCase()}
        </div>
      )}
      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0B0F19] ${player.isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}
          title={player.isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

/** "Last seen" wording for an offline friend. */
export function lastSeenText(lastSeen?: string): string {
  if (!lastSeen) return 'Offline';
  const minutes = Math.round((Date.now() - Date.parse(lastSeen)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return 'Offline';
  if (minutes < 60) return `Last seen ${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Last seen ${hours} h ago`;
  return `Last seen ${Math.round(hours / 24)} d ago`;
}

interface RelationButtonProps {
  player: FriendUser;
  relation: Relation;
  graph: SocialGraph;
  onMessage?: (player: FriendUser) => void;
  onResult?: (message: string, ok: boolean) => void;
  compact?: boolean;
}

/** The one button that matches where you stand with a player: add, pending, accept, or message. */
export const RelationButton: React.FC<RelationButtonProps> = ({ player, relation, graph, onMessage, onResult, compact }) => {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!profile || relation === 'self') return null;

  const run = async (fn: () => Promise<{ success: boolean; message: string } | boolean>, okMessage?: string) => {
    setBusy(true);
    try {
      const res = await fn();
      const ok = typeof res === 'boolean' ? res : res.success;
      const message = typeof res === 'boolean' ? (ok ? okMessage || 'Done.' : 'Something went wrong. Try again.') : res.message;
      onResult?.(message, ok);
    } finally {
      setBusy(false);
    }
  };

  const base = `inline-flex items-center justify-center gap-1.5 rounded-xl font-black uppercase tracking-wider transition-all disabled:opacity-50 ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-[11px]'}`;

  switch (relation) {
    case 'friend':
      return (
        <button type="button" onClick={() => onMessage?.(player)} className={`${base} bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25`}>
          <MessageSquare className="w-3.5 h-3.5" /> Message
        </button>
      );
    case 'requested':
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => cancelFriendRequest(requestIdFor(profile.uid, player.uid)), 'Request cancelled.')}
          title="Cancel request"
          className={`${base} bg-white/5 text-white/60 border border-white/10 hover:bg-white/10`}
        >
          <Clock className="w-3.5 h-3.5" /> Requested
        </button>
      );
    case 'incoming': {
      const req = graph.incomingById.get(player.uid)!;
      return (
        <span className="inline-flex gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => respondToFriendRequest(req.id, true, profile.uid, player.uid), `You and ${player.displayName} are now friends!`)}
            className={`${base} bg-emerald-500 text-black hover:brightness-110`}
          >
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            type="button"
            disabled={busy}
            aria-label="Decline"
            onClick={() => run(() => respondToFriendRequest(req.id, false, profile.uid, player.uid), 'Request declined.')}
            className={`${base} bg-white/5 text-white/60 border border-white/10 hover:bg-white/10`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      );
    }
    case 'blocked':
      return (
        <button type="button" disabled={busy} onClick={() => run(() => unblockUser(profile.uid, player.uid), 'Unblocked.')} className={`${base} bg-white/5 text-white/60 border border-white/10`}>
          Unblock
        </button>
      );
    default:
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => sendFriendRequest(profile, player))}
          className={`${base} bg-[#F5C453] text-black hover:brightness-110`}
        >
          <UserPlus className="w-3.5 h-3.5" /> Add friend
        </button>
      );
  }
};

interface PlayerRowProps {
  player: FriendUser;
  graph: SocialGraph;
  onMessage?: (player: FriendUser) => void;
  onResult?: (message: string, ok: boolean) => void;
  subtitle?: React.ReactNode;
  unread?: boolean;
  extra?: React.ReactNode;
}

export const PlayerRow: React.FC<PlayerRowProps> = ({ player, graph, onMessage, onResult, subtitle, unread, extra }) => (
  <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors">
    <PlayerAvatar player={player} />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-black text-white truncate">{player.displayName}</span>
        {unread && <span className="shrink-0 w-2 h-2 rounded-full bg-[#F5C453]" aria-label="Unread messages" />}
      </div>
      <div className="text-[11px] text-white/60 truncate">
        {subtitle ?? (
          <>
            {player.username ? `@${player.username} · ` : ''}
            <span className="font-mono">{player.elo}</span> Elo · {player.isOnline ? <span className="text-emerald-400">Online</span> : lastSeenText(player.lastSeen)}
          </>
        )}
      </div>
    </div>
    {extra}
    <RelationButton player={player} relation={graph.relationTo(player.uid)} graph={graph} onMessage={onMessage} onResult={onResult} compact />
  </div>
);
