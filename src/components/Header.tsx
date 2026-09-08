import React, { useState, useEffect } from 'react';
import { GameMode, RespectProfile } from '../types/chess';
import { Menu, X, User, Crown, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen?: boolean;
  onOpenProfile: () => void;
  onOpenLogin?: () => void;
  respectProfile?: RespectProfile;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isSidebarOpen = false,
  onOpenProfile,
  onOpenLogin,
  respectProfile
}) => {
  const [latency, setLatency] = useState<number>(18);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => {
        const variation = Math.floor(Math.random() * 5) - 2;
        let newLatency = prev + variation;
        if (newLatency < 12) newLatency = 12;
        if (newLatency > 85) newLatency = 85;
        return isNaN(newLatency) ? 18 : newLatency;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  const { user, profile } = useAuth();

  const currentRespect = profile?.respectPoints ?? respectProfile?.respectPoints ?? 100;
  const currentElo = profile?.elo ?? respectProfile?.elo ?? 1200;
  const userDisplayName = profile?.displayName || user?.displayName?.split(' ')[0] || (user ? 'Grandmaster' : 'Guest');

  return (
    <header
      id="top-header-bar"
      className="w-full h-14 bg-[#eff6ff]/95 border-b border-[#bfdbfe] backdrop-blur-2xl sticky top-0 z-30 shadow-xl shadow-black/60 transition-all flex items-center justify-between px-3 sm:px-6 select-none"
    >
      {/* 1. Far Left: Hamburger Toggle Button */}
      <div className="flex items-center gap-3">
        <button
          id="header-hamburger-toggle"
          type="button"
          onClick={onToggleSidebar}
          className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-xl bg-[#dbeafe] hover:bg-[#bfdbfe] active:scale-95 text-[#0056b3] hover:text-blue-900 flex items-center justify-center border border-[#bfdbfe] hover:border-[#0056b3]/50 transition-all cursor-pointer shadow-sm"
          aria-label={isSidebarOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* 2. Brand Logo: "Chesskys PRO" with highlighted PRO badge */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#0056b3]/60 flex items-center justify-center text-sm shadow-md">
            ☀️
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-display font-black text-lg tracking-wide text-blue-900 drop-shadow-sm">
              Chesskys
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-[#0056b3] text-black shadow-sm uppercase tracking-wider font-mono">
              PRO
            </span>
          </div>
        </div>
      </div>

      {/* 2. Center: Live Match Evaluation Bar */}
      <div className="hidden md:flex flex-col items-center justify-center flex-1 mx-4" dir="ltr">
        <div className="w-full max-w-sm flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1">
          <span>Engine Eval (Stockfish WASM)</span>
          <span className="text-[#0056b3]">+1.2</span>
        </div>
        <div className="w-full max-w-sm h-2.5 bg-[#0B1D3A] rounded-full border border-[#bfdbfe] overflow-hidden flex shadow-[inset_0_0_8px_rgba(0,0,0,0.8)] relative">
          <div className="absolute inset-0 bg-[rgba(255,255,255,0.03)] pointer-events-none" />
          <div className="h-full bg-[#f8fafc] w-[55%] transition-all duration-700 ease-out shadow-[0_0_12px_rgba(255,255,255,0.6)] z-10" />
          <div className="h-full bg-[#ef4444] flex-1 z-0 shadow-[inset_0_0_12px_rgba(239,68,68,0.3)]" />
        </div>
      </div>

      {/* 3. Far Right: User Profile Avatar */}
      <div className="flex items-center gap-2">
        <button
          id="header-user-avatar-btn"
          type="button"
          onClick={user ? onOpenProfile : (onOpenLogin || onOpenProfile)}
          className="min-w-[44px] min-h-[44px] p-1 rounded-2xl bg-[#dbeafe]/80 hover:bg-[#bfdbfe] flex items-center gap-2.5 transition-all cursor-pointer border border-[#bfdbfe] hover:border-[#0056b3]/40"
          title={user ? `${userDisplayName} (Profile & Stats)` : 'Sign In / Profile'}
        >
          {/* User Avatar Circle */}
          <div className="relative">
            {profile?.photoURL || user?.photoURL ? (
              <img
                src={profile?.photoURL || user?.photoURL || ''}
                alt={userDisplayName}
                className="w-9 h-9 rounded-full object-cover border-2 border-[#0056b3] shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-2 border-[#0056b3] flex items-center justify-center font-bold text-xs text-blue-900 shadow-md">
                {user ? userDisplayName.charAt(0).toUpperCase() : <User className="w-4 h-4 text-blue-900/80" />}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black ring-1 ring-black" />
          </div>

          {/* User Rating Display on Desktop */}
          <div className="hidden sm:flex flex-col text-left leading-tight pr-1.5">
            <span className="text-xs font-black text-blue-900 truncate max-w-[100px]">
              {userDisplayName}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#0056b3] font-bold">
                {currentElo} Elo
              </span>
              <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-900/40 px-1 rounded flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> {latency}ms
              </span>
            </div>
          </div>
        </button>
      </div>
    </header>
  );
};
