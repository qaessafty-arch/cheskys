import React, { useEffect, useState } from 'react';
import { GameMode, RespectProfile, BoardThemeId, PieceThemeId } from '../types/chess';
import { useAuth } from '../context/AuthContext';
import { listenToFriendsList } from '../services/friendService';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from './LanguageSelector';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Swords,
  Sparkles,
  Compass,
  User,
  Globe,
  Users,
  Palette,
  Sun,
  Moon,
  X,
  ChevronRight,
  Shield,
  Crown,
  Layers,
  Settings
, Trophy} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onOpenFriends: () => void;
  onOpenWorldwideMatch: () => void;
  onOpenLeaderboard: () => void;
  onOpenThemes: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  currentThemeName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeMode,
  onSelectMode,
  onOpenFriends,
  onOpenWorldwideMatch,
  onOpenLeaderboard,
  onOpenThemes,
  onOpenSettings,
  onOpenProfile,
  currentThemeName = 'Peshmerga'
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [onlineFriendsCount, setOnlineFriendsCount] = useState<number>(0);
  const [totalFriendsCount, setTotalFriendsCount] = useState<number>(0);

  // Subscribe to friends list for live online count
  useEffect(() => {
    if (!profile?.uid) {
      setOnlineFriendsCount(0);
      setTotalFriendsCount(0);
      return;
    }

    const unsub = listenToFriendsList(profile.uid, friends => {
      if (Array.isArray(friends)) {
        setTotalFriendsCount(friends.length);
        const online = friends.filter(f => f && f.isOnline !== false).length;
        setOnlineFriendsCount(online);
      } else {
        setOnlineFriendsCount(0);
        setTotalFriendsCount(0);
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, [profile?.uid]);

  // Clean formatted online string that NEVER returns "null null"
  const formattedOnlineText = () => {
    if (onlineFriendsCount > 0) {
      return `${onlineFriendsCount} Online`;
    }
    if (totalFriendsCount > 0) {
      return `${totalFriendsCount} ${totalFriendsCount === 1 ? 'Friend' : 'Friends'}`;
    }
    return 'Social';
  };

  const navItems = [
    {
      id: 'ai',
      mode: 'ai' as GameMode,
      label: t('sidebar.playAI'),
      icon: <Bot className="w-5 h-5 text-emerald-400" />,
      action: () => {
        onSelectMode('ai');
        onClose();
      }
    },
    {
      id: 'multiplayer',
      mode: 'multiplayer' as GameMode,
      label: t('sidebar.multiplayer'),
      icon: <Swords className="w-5 h-5 text-amber-400" />,
      action: () => {
        onSelectMode('multiplayer');
        onClose();
      }
    },
    {
      id: 'puzzle',
      mode: 'puzzle' as GameMode,
      label: t('sidebar.puzzles'),
      badge: 'DAILY',
      badgeClass: 'bg-gradient-to-r from-amber-400 to-[#0056b3] text-white font-black text-[10px] px-1.5 py-0.5 rounded shadow-sm',
      icon: <Sparkles className="w-5 h-5 text-yellow-300" />,
      action: () => {
        onSelectMode('puzzle');
        onClose();
      }
    },
    {
      id: 'analysis',
      mode: 'analysis' as GameMode,
      label: t('sidebar.analysis'),
      icon: <Compass className="w-5 h-5 text-sky-400" />,
      action: () => {
        onSelectMode('analysis');
        onClose();
      }
    },
    {
      id: 'profile',
      mode: 'profile_page' as GameMode,
      label: t('sidebar.profile'),
      icon: <User className="w-5 h-5 text-purple-400" />,
      action: () => {
        onOpenProfile();
        onClose();
      }
    },
    {
      id: 'leaderboard',
      label: t('sidebar.worldwide') + ' Leaderboard',
      icon: <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />,
      action: () => {
        onOpenLeaderboard();
        onClose();
      }
    },
    {
      id: 'worldwide',
      label: t('sidebar.worldwide'),
      icon: <Globe className="w-5 h-5 text-blue-400" />,
      action: () => {
        onOpenWorldwideMatch();
        onClose();
      }
    },
    {
      id: 'friends',
      label: t('sidebar.friends'),
      badge: formattedOnlineText(),
      badgeClass: onlineFriendsCount > 0 
        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1'
        : 'bg-[#bfdbfe] text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-white/5',
      badgeDot: onlineFriendsCount > 0,
      icon: <Users className="w-5 h-5 text-indigo-400" />,
      action: () => {
        onOpenFriends();
        onClose();
      }
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile Backdrop Overlay with Smooth Fade */}
          <motion.div
            key="sidebar-backdrop"
            id="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Collapsible Left Sidebar Drawer with Smooth Spring Animation */}
          <motion.aside
            key="app-collapsible-sidebar"
            id="app-collapsible-sidebar"
            initial={{ x: document.documentElement.dir === 'rtl' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: document.documentElement.dir === 'rtl' ? '100%' : '-100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed top-0 bottom-0 start-0 z-50 w-72 sm:w-80 bg-[#eff6ff] border-e border-[#bfdbfe] shadow-2xl flex flex-col justify-between select-none"
            aria-label="Application Main Sidebar"
            style={{ willChange: 'transform' }}
          >
            {/* Sidebar Header & Brand */}
            <div className="p-4 border-b border-[#bfdbfe] flex items-center justify-between bg-[#dbeafe]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#0056b3]/60 flex items-center justify-center text-lg shadow-lg">
                  ☀️
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-black text-base text-blue-900 tracking-wide">
                      Chesskys
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-[#0056b3] text-white shadow-sm uppercase tracking-wider font-mono">
                      PRO
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-700/60 font-mono">Peshmerga Edition</p>
                </div>
              </div>

              <button
                id="sidebar-close-btn"
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-[#bfdbfe]/70 hover:bg-[#bfdbfe] text-slate-300 hover:text-blue-900 flex items-center justify-center transition-colors cursor-pointer border border-white/10"
                aria-label="Close Sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Navigation Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Game Navigation
              </div>

              {navItems.map(item => {
                const isActive = item.mode && activeMode === item.mode;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-nav-${item.id}`}
                    type="button"
                    onClick={item.action}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer group ${
                      isActive
                        ? 'bg-gradient-to-r from-[#dbeafe] to-[#bfdbfe] text-blue-900 font-bold border border-[#0056b3]/60 shadow-lg shadow-black/40'
                        : 'text-slate-300 hover:text-blue-900 hover:bg-[#dbeafe]/70 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-xl transition-transform group-hover:scale-110 ${
                        isActive ? 'bg-[#0056b3]/20 text-[#0056b3]' : 'bg-[#dbeafe]'
                      }`}>
                        {item.icon}
                      </div>
                      <span className="text-sm font-semibold">{item.label}</span>
                    </div>

                    {item.badge && (
                      <div className="flex items-center gap-1">
                        <span className={item.badgeClass}>
                          {item.badgeDot && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          {item.badge}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom Theme & Settings Controls (Pinned) */}
            <div className="p-3 border-t border-[#bfdbfe] bg-[#dbeafe]/90 space-y-2">
              {/* Switch Theme Button */}
              <button
                id="sidebar-switch-theme-btn"
                type="button"
                onClick={() => {
                  onOpenThemes();
                  onClose();
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-[#eff6ff] hover:bg-[#bfdbfe]/80 border border-[#bfdbfe] hover:border-[#0056b3]/40 text-blue-900 flex items-center justify-between transition-all cursor-pointer shadow-md group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 group-hover:rotate-12 transition-transform">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <span>🌙/☀️ Theme Switcher</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-400 text-white font-black font-mono">
                        3 PACK
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-700/60 truncate block max-w-[130px]">
                      AoT • Batman • Classic
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-900/50 group-hover:translate-x-0.5 transition-transform rtl-flip" />
              </button>

              {/* Quick Settings Action */}
              <button
                id="sidebar-settings-btn"
                type="button"
                onClick={() => {
                  onOpenSettings();
                  onClose();
                }}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#eff6ff]/60 hover:bg-[#bfdbfe] text-slate-300 hover:text-blue-900 flex items-center justify-center gap-2 text-xs font-semibold transition-colors cursor-pointer border border-[#bfdbfe]"
              >
                <Settings className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('sidebar.settings')}</span>
              </button>
              
              <LanguageSelector />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

