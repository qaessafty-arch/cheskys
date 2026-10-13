import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, X, MessageSquare, Users, Award, Zap, AlertCircle } from 'lucide-react';
import { Notification } from '../types/chess';
import { useDemo } from '../context/DemoContext';

interface NotificationBellProps {
  onToggle: (show: boolean) => void;
  isOpen: boolean;
}

const NOTIFICATION_ICONS: Record<Notification['type'], React.ReactNode> = {
  challenge: <MessageSquare className="w-5 h-5 text-[var(--tertiary-accent)]" />,
  friend_request: <Users className="w-5 h-5 text-[var(--primary-accent)]" />,
  achievement: <Award className="w-5 h-5 text-[var(--secondary-accent)]" />,
  tournament: <Zap className="w-5 h-5 text-[var(--danger)]" />,
};

export const NotificationBell: React.FC<NotificationBellProps> = ({ onToggle, isOpen }) => {
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadNotificationCount } = useDemo();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onToggle(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => onToggle(!isOpen)}
        className="relative w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center transition-colors"
        style={{ color: unreadNotificationCount > 0 ? 'var(--primary-accent)' : 'var(--text-muted)' }}
        aria-label={`Notifications${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} unread` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {unreadNotificationCount > 0 && (
          <motion.span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
            style={{ backgroundColor: 'var(--danger)', color: 'white' }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 glass-panel rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-[var(--glass-border)] overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
              <h3 className="font-black text-[var(--text-main)]">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadNotificationCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--primary-accent)] hover:text-yellow-400 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => onToggle(false)}
                  className="w-8 h-8 rounded-lg glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-dim)]">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`flex items-start gap-3 p-4 hover:bg-[var(--glass-bg-hover)] transition-colors ${!notification.read ? 'bg-[var(--glass-bg)]/50' : ''}`}
                      onClick={() => markNotificationRead(notification.id)}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${getNotificationColor(notification.type)}20` }}>
                        {NOTIFICATION_ICONS[notification.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-[var(--text-main)] truncate">{notification.title}</h4>
                          <span className="text-[10px] text-[var(--text-dim)] whitespace-nowrap">
                            {formatTimeAgo(notification.timestamp)}
                          </span>
                        </div>
                        <p className="text-[var(--text-muted)] text-sm mt-1 truncate">{notification.message}</p>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: 'var(--primary-accent)' }} />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function getNotificationColor(type: Notification['type']): string {
  switch (type) {
    case 'challenge': return '#60A5FA';
    case 'friend_request': return '#F5B83D';
    case 'achievement': return '#6EE7B7';
    case 'tournament': return '#FB7185';
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}