import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chess } from 'chess.js';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface MoveHistoryProps {
  game: Chess;
  onGoToMove: (moveIndex: number) => void;
  currentMoveIndex: number;
  maxHeight?: number;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  game,
  onGoToMove,
  currentMoveIndex,
  maxHeight = 400,
}) => {
  const moves = useMemo(() => {
    const history = game.history({ verbose: true });
    const movePairs: Array<{ moveNumber: number; white: string; black?: string }> = [];

    for (let i = 0; i < history.length; i += 2) {
      movePairs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: history[i].san,
        black: history[i + 1]?.san,
      });
    }
    return movePairs;
  }, [game]);

  return (
    <div className="w-full max-h-[400px] overflow-y-auto glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-muted)]">Move History</h3>
        <span className="text-xs text-[var(--text-dim)]">{moves.length} moves</span>
      </div>
      <AnimatePresence mode="popLayout">
        {moves.map((pair, idx) => (
          <motion.div
            key={pair.moveNumber}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer"
            style={{
              backgroundColor: idx === currentMoveIndex ? 'rgba(245,184,61,0.15)' : 'transparent',
              borderLeft: idx === currentMoveIndex ? '3px solid var(--primary-accent)' : 'none',
            }}
            onClick={() => onGoToMove(idx * 2)}
          >
            <span className="w-8 text-right text-[var(--text-dim)] font-mono text-xs">
              {pair.moveNumber}.
            </span>
            <span className="flex-1 text-[var(--text-main)] font-medium select-none">{pair.white}</span>
            {pair.black && (
              <span className="flex-1 text-[var(--text-muted)] select-none">{pair.black}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      {moves.length === 0 && (
        <div className="text-center py-8 text-[var(--text-dim)]">
          No moves yet
        </div>
      )}
    </div>
  );
};