import React from 'react';
import { motion } from 'motion/react';
import { Menu, Bell, User, Trophy, Settings, ChevronDown, X, Sun, Moon, Layout } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ showBack = false, onBack, title }) => {
  const { presentationMode, togglePresentationMode, showNotifications, setShowNotifications, settings, updateSettings, viewMode, setViewMode } = useDemo();

  // These screens draw their own top bar (with a back button). Two fixed headers would overlap.
  if (['landing', 'game', 'settings', 'tournaments', 'leaderboard', 'profile', 'replay'].includes(viewMode)) return null;

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3"
      style={{ backdropFilter: 'blur(20px)' }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          {showBack && onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              aria-label="Back"
            >
              <ChevronDown className="w-5 h-5 rotate-180" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center">
              <span className="text-xl">♟️</span>
            </div>
            <span className="font-black text-xl text-[var(--text-main)] hidden sm:block">Chesskys</span>
          </div>
          {title && <span className="text-[var(--text-dim)] text-sm hidden md:block">{title}</span>}
        </div>

        {/* Center - Demo badge in presentation mode */}
        {presentationMode && (
          <motion.span
            className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
            style={{ backgroundColor: 'rgba(245,184,61,0.2)', color: 'var(--primary-accent)', border: '1px solid var(--primary-accent)' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            🎬 PRESENTATION MODE
          </motion.span>
        )}

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* View mode indicator */}
          {viewMode !== 'dashboard' && (
            <span className="hidden sm:block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--glass-bg)] text-[var(--text-dim)] border border-[var(--glass-border)]">
              {viewMode.toUpperCase()}
            </span>
          )}

          {/* Theme toggle */}
          <button
            onClick={() => updateSettings({ boardTheme: settings.boardTheme === 'ukh' ? 'peshmerga' : 'ukh' })}
            className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            aria-label="Toggle theme"
          >
            <Sun className="w-5 h-5" />
          </button>

          {/* Presentation mode toggle */}
          <button
            onClick={togglePresentationMode}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              presentationMode
                ? 'bg-[var(--primary-accent)]/20 text-[var(--primary-accent)] border border-[var(--primary-accent)]/30'
                : 'glass-panel-hover text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
            aria-label={presentationMode ? 'Exit presentation mode' : 'Enter presentation mode'}
          >
            <Layout className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <NotificationBell onToggle={setShowNotifications} isOpen={showNotifications} />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setViewMode('profile')}
              aria-label="Profile"
              className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors relative"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.header>
  );
};