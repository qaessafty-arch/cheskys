import React, { useRef, useEffect } from 'react';
import { MoveLog, OpeningInfo, MoveClassification } from '../types/chess';
import { Copy, Check, BookOpen, Layers } from 'lucide-react';

interface MoveHistoryProps {
  moveLogs: MoveLog[];
  currentMoveIndex: number;
  onSelectMoveIndex: (index: number) => void;
  openingInfo: OpeningInfo | null;
  pgn: string;
  fen: string;
}

const BADGE_MAP: Record<MoveClassification, { icon: string; text: string; bg: string; border: string }> = {
  brilliant: { icon: '💎', text: 'Brilliant', bg: 'bg-cyan-500/20 text-cyan-200', border: 'border-cyan-400/40' },
  best: { icon: '★', text: 'Best', bg: 'bg-emerald-500/20 text-emerald-200', border: 'border-emerald-400/40' },
  good: { icon: '✓', text: 'Good', bg: 'bg-blue-500/20 text-blue-200', border: 'border-blue-400/40' },
  book: { icon: '📖', text: 'Book', bg: 'bg-purple-500/20 text-purple-200', border: 'border-purple-400/40' },
  inaccuracy: { icon: '?!', text: 'Inaccuracy', bg: 'bg-yellow-500/20 text-yellow-200', border: 'border-yellow-400/40' },
  mistake: { icon: '?', text: 'Mistake', bg: 'bg-orange-500/20 text-orange-200', border: 'border-orange-400/40' },
  blunder: { icon: '??', text: 'Blunder', bg: 'bg-rose-500/20 text-rose-200', border: 'border-rose-400/40' }
};

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  moveLogs,
  currentMoveIndex,
  onSelectMoveIndex,
  openingInfo,
  pgn,
  fen
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeMoveRef = useRef<HTMLButtonElement | null>(null);
  const latestMoveRef = useRef<HTMLButtonElement | null>(null);
  const endAnchorRef = useRef<HTMLDivElement | null>(null);
  const [copiedPgn, setCopiedPgn] = React.useState(false);
  const [copiedFen, setCopiedFen] = React.useState(false);
  const touchStartXRef = useRef<number | null>(null);

  // Swipe horizontally on the move list to step through the game
  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };
  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? 0;
    const dx = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) {
      // Swipe left → forward toward latest move
      onSelectMoveIndex(Math.min(moveLogs.length - 1, currentMoveIndex + 1));
    } else {
      // Swipe right → back toward oldest move
      onSelectMoveIndex(Math.max(0, currentMoveIndex - 1));
    }
  };

  useEffect(() => {
    // Smooth auto-scroll so the latest move or currently selected move is always visible
    const timer = requestAnimationFrame(() => {
      const targetElement = activeMoveRef.current || latestMoveRef.current || endAnchorRef.current;
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      } else if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    });

    return () => cancelAnimationFrame(timer);
  }, [moveLogs.length, currentMoveIndex]);

  // Group moves into pairs (White & Black)
  const movePairs: { turnNumber: number; white?: { log: MoveLog; index: number }; black?: { log: MoveLog; index: number } }[] = [];

  for (let i = 0; i < moveLogs.length; i += 2) {
    const turnNumber = Math.floor(i / 2) + 1;
    movePairs.push({
      turnNumber,
      white: { log: moveLogs[i], index: i },
      black: moveLogs[i + 1] ? { log: moveLogs[i + 1], index: i + 1 } : undefined
    });
  }

  const latestIndex = moveLogs.length - 1;

  const handleCopyPgn = () => {
    navigator.clipboard.writeText(pgn || 'No moves recorded yet.');
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  const handleCopyFen = () => {
    navigator.clipboard.writeText(fen);
    setCopiedFen(true);
    setTimeout(() => setCopiedFen(false), 2000);
  };

  return (
    <div className="flex flex-col h-full obsidian-panel overflow-hidden shadow-2xl" dir="ltr">
      {/* Header with Opening Badge */}
      <div className="p-4 border-b border-[#1F293D] bg-[#111827] flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-1.5 rounded-lg bg-[#0B0F19] border border-[#F59E0B]/30 text-[#F59E0B]">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="truncate">
            {openingInfo ? (
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-[#F59E0B] text-[#0B0F19] shadow-sm uppercase">
                  {openingInfo.eco}
                </span>
                <span className="text-[11px] font-black text-white tracking-tight truncate">
                  {openingInfo.name}
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#94A3B8] opacity-50">Opening Analysis</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyFen}
            className="px-2 py-1.5 rounded-lg bg-[#0B0F19] border border-[#1F293D] text-[9px] font-black text-[#94A3B8] hover:text-[#F59E0B] hover:border-[#F59E0B]/30 transition-all interactive-btn uppercase tracking-tighter"
            title="Copy FEN string"
          >
            {copiedFen ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : 'FEN'}
          </button>
          <button
            onClick={handleCopyPgn}
            className="p-1.5 rounded-lg bg-[#0B0F19] border border-[#1F293D] text-[#94A3B8] hover:text-[#F59E0B] hover:border-[#F59E0B]/30 transition-all interactive-btn"
            title="Copy PGN notation"
          >
            {copiedPgn ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Move list table */}
      <div ref={scrollRef} onTouchStart={handleSwipeTouchStart} onTouchEnd={handleSwipeTouchEnd} className="flex-1 overflow-y-auto p-3 space-y-1 font-mono scroll-smooth custom-scrollbar">
        {movePairs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#94A3B8] py-10 gap-3 px-6">
            <Layers className="w-9 h-9 stroke-[1] opacity-25" />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">No moves yet</span>
            <span className="text-[10px] font-mono opacity-40 leading-relaxed">
              Play a move on the board and the notation will appear here.
            </span>
          </div>
        ) : (
          movePairs.map(pair => {
            const isWhiteActive = pair.white && currentMoveIndex === pair.white.index;
            const isBlackActive = pair.black && currentMoveIndex === pair.black.index;
            const isWhiteLatest = pair.white && pair.white.index === latestIndex;
            const isBlackLatest = pair.black && pair.black.index === latestIndex;
            const hasLatestMove = isWhiteLatest || isBlackLatest;

            return (
              <div
                key={pair.turnNumber}
                className={`grid grid-cols-12 items-center px-2 py-1 rounded-xl transition-all duration-300 ${
                  pair.turnNumber % 2 === 0 ? 'bg-[#0B0F19]/20' : 'bg-transparent'
                } ${hasLatestMove ? 'ring-1 ring-amber-400/20 bg-amber-500/[0.04]' : ''}`}
              >
                {/* Turn Number */}
                <span className="col-span-2 text-[10px] font-black text-[#94A3B8] opacity-40">{pair.turnNumber}.</span>

                {/* White Move */}
                <div className="col-span-5 flex items-center justify-between pr-1">
                  {pair.white && (
                    <button
                      ref={el => {
                        if (isWhiteActive) activeMoveRef.current = el;
                        if (isWhiteLatest) latestMoveRef.current = el;
                      }}
                      onClick={() => onSelectMoveIndex(pair.white!.index)}
                      className={`w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-lg text-left font-black text-[11px] transition-all duration-200 interactive-btn relative overflow-hidden ${
                        isWhiteActive
                          ? 'bg-[#F59E0B] text-[#0B0F19] shadow-lg shadow-[#F59E0B]/20 scale-[1.02]'
                          : isWhiteLatest
                          ? 'text-white bg-[#111827] border border-amber-400/50 shadow-sm shadow-amber-400/10'
                          : 'text-white hover:bg-[#111827] border border-transparent hover:border-[#1F293D]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {isWhiteLatest && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0" title="Latest move">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                          </span>
                        )}
                        <span className="truncate">{pair.white.log.san}</span>
                      </span>
                      {pair.white.log.classification && BADGE_MAP[pair.white.log.classification] && (
                        <span
                          className="text-[10px] leading-none shrink-0"
                          title={BADGE_MAP[pair.white.log.classification].text}
                        >
                          {BADGE_MAP[pair.white.log.classification].icon}
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* Black Move */}
                <div className="col-span-5 flex items-center justify-between pl-1">
                  {pair.black && (
                    <button
                      ref={el => {
                        if (isBlackActive) activeMoveRef.current = el;
                        if (isBlackLatest) latestMoveRef.current = el;
                      }}
                      onClick={() => onSelectMoveIndex(pair.black!.index)}
                      className={`w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-lg text-left font-black text-[11px] transition-all duration-200 interactive-btn relative overflow-hidden ${
                        isBlackActive
                          ? 'bg-[#F59E0B] text-[#0B0F19] shadow-lg shadow-[#F59E0B]/20 scale-[1.02]'
                          : isBlackLatest
                          ? 'text-white bg-[#111827] border border-amber-400/50 shadow-sm shadow-amber-400/10'
                          : 'text-[#94A3B8] hover:text-white hover:bg-[#111827] border border-transparent hover:border-[#1F293D]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {isBlackLatest && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0" title="Latest move">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                          </span>
                        )}
                        <span className="truncate">{pair.black.log.san}</span>
                      </span>
                      {pair.black.log.classification && BADGE_MAP[pair.black.log.classification] && (
                        <span
                          className="text-[10px] leading-none shrink-0"
                          title={BADGE_MAP[pair.black.log.classification].text}
                        >
                          {BADGE_MAP[pair.black.log.classification].icon}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endAnchorRef} className="h-0 w-full" aria-hidden="true" />
      </div>
    </div>
  );
};
