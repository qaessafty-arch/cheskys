import React, { useState, useEffect, useRef } from 'react';
import { GameMode, RespectProfile, Notification } from '../types/chess';
import { Menu, X, User, Crown, Shield, Bell, Swords, UserPlus, Trophy, Info, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { KurdishFlag } from './KurdishFlag';

const LatencyIndicator: React.FC = React.memo(() => {
  // Measured round trip to the app server; null while unknown or offline.
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const measure = async () => {
      const start = performance.now();
      try {
        await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (!cancelled) setLatency(Math.round(performance.now() - start));
      } catch {
        if (!cancelled) setLatency(null);
      }
    };
    measure();
    const interval = setInterval(measure, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <span className={`text-[10px] font-black uppercase tracking-widest ${latency === null ? 'text-[var(--text-muted)]' : latency < 150 ? 'text-[#10B981]' : 'text-[var(--secondary-accent)]'}`}>
      {latency === null ? 'offline' : `${latency}ms`}
    </span>
  );
});

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen?: boolean;
  onOpenProfile: () => void;
  onOpenLogin?: () => void;
  respectProfile?: RespectProfile;
  /** Evaluation of the game on the board in pawns, White's point of view; hidden when null. */
  evaluation?: number | null;
  /** Set once the game on the board is decided, e.g. '1-0'. */
  resultLabel?: string | null;
  /** Forced mate in this many moves (positive: White mates). */
  mateIn?: number | null;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isSidebarOpen = false,
  onOpenProfile,
  onOpenLogin,
  respectProfile,
  evaluation = null,
  resultLabel = null,
  mateIn = null
}) => {
  // White's share of the bar: 50% when equal, saturating around ±5 pawns.
  const whiteShare = evaluation === null ? 50 : Math.max(3, Math.min(97, 50 + 50 * Math.tanh(evaluation / 4)));
  const evalText = resultLabel
    ?? (mateIn !== null && mateIn !== 0 ? `${mateIn > 0 ? '' : '-'}M${Math.abs(mateIn)}`
      : evaluation === null ? '' : `${evaluation > 0 ? '+' : ''}${evaluation.toFixed(1)}`);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Sidebar "Celestial Messages" dispatches 'open-notifications' to open this panel
  useEffect(() => {
    const handleOpenNotifications = () => setIsNotifOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNotifOpen(false);
    };
    window.addEventListener('open-notifications', handleOpenNotifications);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-notifications', handleOpenNotifications);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Close on any click outside the bell and panel. A fixed full-screen backdrop
  // cannot do this: the header's backdrop-filter makes it the containing block,
  // so the backdrop would only cover the header strip.
  useEffect(() => {
    if (!isNotifOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isNotifOpen]);

  const { user, profile } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotification();

  const currentRespect = profile?.respectPoints ?? respectProfile?.respectPoints ?? 100;
  const currentElo = profile?.elo ?? respectProfile?.elo ?? 1200;
  const userDisplayName = profile?.displayName || user?.displayName?.split(' ')[0] || (user ? 'Player' : 'Guest');

  return (
    <header
      id="top-header-bar"
      className="w-full h-14 glass-panel !rounded-none border-b border-white/10 backdrop-blur-3xl sticky top-0 z-30 shadow-2xl transition-all flex items-center justify-between px-4 sm:px-8 select-none"
    >
      {/* 1. Far Left: Hamburger Toggle Button */}
      <div className="flex items-center gap-4">
        <button
          id="header-hamburger-toggle"
          type="button"
          onClick={onToggleSidebar}
          className="w-10 h-10 glass-button text-[var(--secondary-accent)] border-white/5 interactive-btn shadow-lg"
          aria-label={isSidebarOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* 2. Brand Logo */}
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-7 rounded shadow-xl overflow-hidden group-hover:scale-110 transition-transform duration-300">
            <KurdishFlag />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-xl tracking-tight text-white drop-shadow-md">
              Chesskys
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[var(--secondary-accent)] text-[var(--app-bg)] shadow-lg uppercase tracking-tighter font-mono">
              PRO
            </span>
          </div>
        </div>
      </div>

      {/* 2. Center: Live Match Evaluation Bar */}
      <div className={`hidden md:flex flex-col items-center justify-center flex-1 mx-8 ${evaluation === null && !resultLabel ? 'invisible' : ''}`} dir="ltr">
        <div className="w-full max-w-sm flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
          <span>Evaluation</span>
          <span className="text-[var(--secondary-accent)] font-black">{evalText}</span>
        </div>
        <div className="w-full max-w-sm h-1.5 bg-[var(--app-bg)] rounded-full border border-[var(--glass-border)] overflow-hidden flex relative shadow-inner">
          <div className="h-full bg-white transition-all duration-700 ease-out shadow-[0_0_15px_rgba(255,255,255,0.4)] z-10" style={{ width: `${whiteShare}%` }} />
          <div className="h-full bg-[#EF4444] flex-1 z-0 opacity-80" />
        </div>
      </div>

      {/* 3. Far Right: User Profile Avatar & Stats */}
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Connection Status - Hidden on mobile */}
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] leading-none">Rating</span>
          <span className="text-[11px] font-mono font-black text-white mt-1">
            {currentElo} <span className="text-[var(--secondary-accent)]">ELO</span>
          </span>
        </div>

        {/* Notification Bell - rendered for guests too so Celestial Messages always opens */}
        <div className="relative" ref={notifRef}>
          <button
            id="header-notif-bell-btn"
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`w-10 h-10 glass-button flex items-center justify-center hover:border-[var(--secondary-accent)]/30 transition-all relative interactive-btn ${isNotifOpen ? 'text-[var(--secondary-accent)] border-[var(--secondary-accent)]/30' : 'text-[var(--text-muted)]'}`}
            aria-label="View Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#EF4444] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[var(--app-bg)] animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotifOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute right-0 mt-3 w-[min(320px,calc(100vw-2rem))] sm:w-[380px] bg-[var(--app-bg)] [background-image:linear-gradient(var(--glass-panel),var(--glass-panel))] border border-[var(--glass-border)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden"
                >
                  {/* Header */}
                  <div className="p-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--app-bg)]/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-white uppercase tracking-widest">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--secondary-accent)] text-[var(--app-bg)] text-[10px] font-black shadow-sm">{unreadCount}</span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={() => markAllAsRead()}
                        className="text-[10px] font-black text-[var(--secondary-accent)] hover:text-white uppercase tracking-tighter transition-colors"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {/* Scrollable List */}
                  <div className="max-h-[420px] overflow-y-auto no-scrollbar py-1">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <NotificationListItem 
                          key={notif.id} 
                          notification={notif} 
                          onRead={() => markAsRead(notif.id)}
                          onDelete={() => deleteNotification(notif.id)}
                        />
                      ))
                    ) : (
                      <div className="p-12 flex flex-col items-center justify-center text-center gap-4">
                        <div className="w-16 h-16 rounded-3xl bg-[var(--app-bg)] border border-[var(--glass-border)] flex items-center justify-center text-3xl shadow-inner">
                          ☀️
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase tracking-tight">{user ? 'No New Notifications' : 'No Messages Yet'}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1 opacity-60">{user ? "You're all caught up" : 'Sign in to receive challenges, friend requests and room invites'}</p>
                        </div>
                        {!user && onOpenLogin && (
                          <button
                            type="button"
                            onClick={() => { setIsNotifOpen(false); onOpenLogin(); }}
                            className="px-4 py-2 rounded-xl bg-[var(--secondary-accent)] text-[var(--app-bg)] text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all"
                          >
                            Sign In
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={onOpenLogin}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#52673A] to-[#8C2425] hover:brightness-110 text-white text-xs font-black uppercase tracking-wider border border-[#F5C453]/40 shadow-lg transition-all cursor-pointer"
        >
          <Swords className="w-3.5 h-3.5" />
          Private Room
        </button>

        <button
          id="header-user-avatar-btn"
          type="button"
          onClick={user ? onOpenProfile : (onOpenLogin || onOpenProfile)}
          className="flex items-center gap-3 p-1.5 pr-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] interactive-btn hover:border-[var(--secondary-accent)]/40 group"
        >
          <div className="relative">
            {profile?.photoURL || user?.photoURL ? (
              <img
                src={profile?.photoURL || user?.photoURL || ''}
                alt={userDisplayName}
                className="w-9 h-9 rounded-xl object-cover ring-1 ring-[var(--glass-border)] group-hover:ring-[var(--secondary-accent)] transition-all"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[var(--app-bg)] flex items-center justify-center text-[var(--secondary-accent)] border border-[var(--glass-border)] group-hover:border-[var(--secondary-accent)] transition-all">
                {user ? <span className="text-xs font-black">{userDisplayName.charAt(0).toUpperCase()}</span> : <User className="w-5 h-5" />}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#10B981] rounded-full border-2 border-[var(--app-bg)] shadow-sm" />
          </div>

          <div className="hidden lg:flex flex-col items-start leading-tight">
            <span className="text-[10px] font-black text-white uppercase tracking-tighter truncate max-w-[80px]">
              {userDisplayName}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <LatencyIndicator />
              <Shield className="w-2.5 h-2.5 text-[var(--secondary-accent)]" />
            </div>
          </div>
        </button>
      </div>
    </header>
  );
};

const NotificationListItem: React.FC<{ 
  notification: Notification; 
  onRead: () => void;
  onDelete: () => void;
}> = ({ notification, onRead, onDelete }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'challenge': return <Swords className="w-4 h-4 text-amber-400" />;
      case 'friend_request': return <UserPlus className="w-4 h-4 text-emerald-400" />;
      case 'achievement': return <Trophy className="w-4 h-4 text-yellow-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div 
      className={`p-4 border-b border-[var(--glass-border)] hover:bg-white/5 transition-colors group cursor-pointer relative ${!notification.isRead ? 'bg-[var(--secondary-accent)]/5' : ''}`}
      onClick={onRead}
    >
      {!notification.isRead && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--secondary-accent)]" />
      )}
      <div className="flex gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
          !notification.isRead ? 'bg-[var(--glass-bg)] border-[var(--secondary-accent)]/30' : 'bg-[var(--app-bg)] border-[var(--glass-border)]'
        }`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-white uppercase tracking-tight truncate">{notification.title}</span>
            <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-normal mt-1 line-clamp-2">{notification.message}</p>
          
          {!notification.isRead && (
            <div className="flex items-center gap-2 mt-3">
              {(notification.type === 'challenge' || notification.type === 'room_invite') ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const cleanCode = (
                        notification.actionData?.roomCode ||
                        notification.actionData?.matchId ||
                        ''
                      ).trim().toUpperCase();

                      if (cleanCode) {
                        window.dispatchEvent(new CustomEvent('accept-challenge', {
                          detail: {
                            matchId: cleanCode,
                            roomCode: cleanCode,
                            inviteId: notification.id,
                            notificationType: notification.type
                          }
                        }));
                        window.dispatchEvent(new CustomEvent('room_invite_response', {
                          detail: {
                            status: 'accepted',
                            inviteId: notification.id,
                            roomCode: cleanCode
                          }
                        }));
                      }
                      onRead();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-black uppercase tracking-wider hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all"
                  >
                    Accept
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const cleanCode = (
                        notification.actionData?.roomCode ||
                        notification.actionData?.matchId ||
                        ''
                      ).trim().toUpperCase();
                      window.dispatchEvent(new CustomEvent('room_invite_response', {
                        detail: {
                          status: 'declined',
                          inviteId: notification.id,
                          roomCode: cleanCode
                        }
                      }));
                      onRead();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-black uppercase tracking-wider hover:bg-red-400 hover:scale-105 active:scale-95 transition-all"
                  >
                    Decline
                  </button>
                </>
              ) : (
                <button 
                  onClick={(e) => { e.stopPropagation(); onRead(); }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--secondary-accent)] text-[var(--app-bg)] text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all"
                >
                  View
                </button>
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onRead();
                }}
                className="px-3 py-1.5 rounded-lg bg-[var(--glass-border)] text-white text-xs font-black uppercase tracking-wider hover:bg-[var(--glass-bg-hover)] transition-all"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-red-400 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Header;

