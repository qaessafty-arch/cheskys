import React from 'react';
import { Timer, Zap, Shield, Flame } from 'lucide-react';

interface ChessClockProps {
  timeSeconds: number;
  isActive: boolean;
  isWhite: boolean;
  playerName: string;
  playerTitle?: string;
  avatar?: string;
  elo?: number;
  isUnlimited?: boolean;
  aotVariant?: 'scout' | 'titan';
}

export const ChessClock: React.FC<ChessClockProps> = ({
  timeSeconds,
  isActive,
  isWhite,
  playerName,
  playerTitle,
  avatar,
  elo,
  isUnlimited = false,
  aotVariant
}) => {
  const renderTitleBadge = (title: string | undefined) => {
    if (!title || !['GM', 'IM', 'FM', 'NM'].includes(title)) return null;
    let bg = 'bg-slate-700/50 text-slate-300 border-slate-600/50';
    if (title === 'GM') bg = 'bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
    else if (title === 'IM') bg = 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
    else if (title === 'FM') bg = 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.3)]';
    else if (title === 'NM') bg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
    
    return (
      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm border ${bg} ml-2`}>
        {title}
      </span>
    );
  };

  const safeTime = isNaN(timeSeconds) ? 0 : Math.max(0, timeSeconds);
  const minutes = Math.floor(safeTime / 60);
  const seconds = Math.floor(safeTime % 60);
  const isLowTime = !isUnlimited && safeTime < 30;
  const isCritical = !isUnlimited && safeTime <= 10;

  const formattedTime = isUnlimited
    ? '∞'
    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Custom AoT styling
  const isScout = aotVariant === 'scout';
  const isTitan = aotVariant === 'titan';

  let cardClasses = 'bg-white/[0.04] border-white/10';
  if (isScout) {
    cardClasses = isActive
      ? 'bg-[#5d6f54]/25 border-emerald-400/60 shadow-[0_0_25px_rgba(34,197,94,0.35)]'
      : 'bg-[#5d6f54]/10 border-emerald-500/20';
  } else if (isTitan) {
    cardClasses = isActive
      ? 'bg-red-950/40 border-red-500/60 shadow-[0_0_25px_rgba(239,68,68,0.35)]'
      : 'bg-red-950/20 border-red-500/20';
  } else if (isActive) {
    cardClasses = 'bg-white/10 border-blue-400/50 shadow-[0_0_20px_rgba(96,165,250,0.2)]';
  }

  return (
    <div
      className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all duration-200 border backdrop-blur-md ${cardClasses}`}
    >
      {/* Player Identity */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm backdrop-blur-md border ${
              isScout
                ? 'bg-[#5d6f54]/40 border-emerald-400/50 text-emerald-300'
                : isTitan
                ? 'bg-red-900/50 border-red-500/50 text-red-300'
                : 'bg-white/10 border-white/20'
            }`}
          >
            {avatar || (isWhite ? '♔' : '♚')}
          </div>
          {isActive && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0c] animate-ping ${
                isScout ? 'bg-emerald-400' : isTitan ? 'bg-red-500' : 'bg-emerald-400'
              }`}
            />
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Attack on Titan Military / Shifter Badge */}
            {isScout && (
              <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Scout Regiment</span>
              </span>
            )}
            {isTitan && (
              <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600/20 text-red-300 border border-red-500/40 shadow-sm">
                <Flame className="w-2.5 h-2.5 text-red-400 animate-pulse" />
                <span>Marleyan Titan</span>
              </span>
            )}
            {playerTitle && ['GM', 'IM', 'FM', 'NM'].includes(playerTitle) ? renderTitleBadge(playerTitle) : playerTitle && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {playerTitle}
              </span>
            )}
            <span className="text-xs sm:text-sm font-semibold text-white/90 leading-none">
              {playerName}
            </span>
          </div>
          {elo !== undefined && (
            <span className="text-[11px] font-mono text-white/50">
              Rating: <strong className="text-white/80 font-bold">{elo}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Clock Display */}
      <div
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono font-bold text-sm sm:text-base border transition-all backdrop-blur-md ${
          isCritical
            ? 'bg-rose-950/80 text-rose-300 border-rose-500/80 animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.4)]'
            : isLowTime
            ? 'bg-amber-950/70 text-amber-300 border-amber-500/70'
            : isActive
            ? isScout
              ? 'bg-emerald-950/60 text-emerald-200 border-emerald-400/60 shadow-[inset_0_0_10px_rgba(34,197,94,0.3)]'
              : isTitan
              ? 'bg-red-950/70 text-red-200 border-red-500/60 shadow-[inset_0_0_10px_rgba(239,68,68,0.3)]'
              : 'bg-blue-950/40 text-blue-200 border-blue-400/40 shadow-inner shadow-blue-500/10'
            : 'bg-white/[0.03] text-white/50 border-white/10'
        }`}
      >
        <Timer
          className={`w-3.5 h-3.5 ${
            isActive
              ? isScout
                ? 'text-emerald-400'
                : isTitan
                ? 'text-red-400'
                : 'text-blue-400'
              : 'text-white/40'
          }`}
        />
        <span className="tracking-wider">{formattedTime}</span>
      </div>
    </div>
  );
};
