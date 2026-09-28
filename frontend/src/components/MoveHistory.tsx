// FILE: frontend/src/components/MoveHistory.tsx
import React, { useRef, useEffect } from 'react';
import { Download, ScrollText } from 'lucide-react';

interface MoveHistoryProps {
  moves: string[]; // SAN array e.g. ['e4', 'e5', 'Nf3', 'Nc6']
  currentMoveIndex?: number;
  onSelectMove?: (index: number) => void;
  onExportPgn?: () => void;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  moves,
  currentMoveIndex,
  onSelectMove,
  onExportPgn
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeMoveRef = useRef<HTMLButtonElement | null>(null);
  const latestMoveRef = useRef<HTMLButtonElement | null>(null);
  const endAnchorRef = useRef<HTMLDivElement | null>(null);

  // Group moves into pairs: [ { number: 1, white: 'e4', black: 'e5' }, ... ]
  const pairs: { number: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1]
    });
  }

  const latestIndex = moves.length - 1;

  useEffect(() => {
    // Smooth auto-scroll so latest move is always kept visible when it happens
    const rafId = requestAnimationFrame(() => {
      const target = activeMoveRef.current || latestMoveRef.current || endAnchorRef.current;
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      } else if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [moves.length, currentMoveIndex]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-full text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <ScrollText className="w-4 h-4 text-amber-500" />
          Move History ({moves.length} moves)
        </div>
        {onExportPgn && (
          <button
            onClick={onExportPgn}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-amber-400 transition-colors px-2 py-1 rounded bg-slate-850 hover:bg-slate-800 border border-slate-700/50"
            title="Download PGN"
          >
            <Download className="w-3 h-3" />
            PGN
          </button>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-1 font-mono text-xs pr-1 scroll-smooth">
        {pairs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic text-xs py-8">
            Game awaiting opening move...
          </div>
        ) : (
          pairs.map((pair, idx) => {
            const whiteMoveIdx = idx * 2;
            const blackMoveIdx = idx * 2 + 1;
            const isWhiteActive = currentMoveIndex === whiteMoveIdx;
            const isBlackActive = currentMoveIndex === blackMoveIdx;
            const isWhiteLatest = latestIndex === whiteMoveIdx;
            const isBlackLatest = latestIndex === blackMoveIdx;

            return (
              <div
                key={pair.number}
                className={`grid grid-cols-6 items-center py-1 px-2 rounded transition-all duration-300 ${
                  isWhiteLatest || isBlackLatest ? 'bg-amber-500/10 ring-1 ring-amber-500/20' : 'hover:bg-slate-800/60'
                }`}
              >
                <span className="col-span-1 text-slate-500 font-sans text-[11px]">
                  {pair.number}.
                </span>
                <button
                  ref={el => {
                    if (isWhiteActive) activeMoveRef.current = el;
                    if (isWhiteLatest) latestMoveRef.current = el;
                  }}
                  onClick={() => onSelectMove && onSelectMove(whiteMoveIdx)}
                  className={`col-span-2 text-left font-semibold px-1 rounded transition-all duration-200 flex items-center gap-1 ${
                    isWhiteActive
                      ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                      : isWhiteLatest
                      ? 'text-white border border-amber-400/30'
                      : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {isWhiteLatest && (
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                    </span>
                  )}
                  <span>{pair.white}</span>
                </button>
                <div className="col-span-3 text-left">
                  {pair.black ? (
                    <button
                      ref={el => {
                        if (isBlackActive) activeMoveRef.current = el;
                        if (isBlackLatest) latestMoveRef.current = el;
                      }}
                      onClick={() => onSelectMove && onSelectMove(blackMoveIdx)}
                      className={`font-semibold px-1 rounded transition-all duration-200 flex items-center gap-1 ${
                        isBlackActive
                          ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                          : isBlackLatest
                          ? 'text-white border border-amber-400/30'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {isBlackLatest && (
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                        </span>
                      )}
                      <span>{pair.black}</span>
                    </button>
                  ) : (
                    <span className="text-slate-600">...</span>
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
