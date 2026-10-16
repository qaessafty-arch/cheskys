import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PieceType, PieceColor } from '../types/chess';
import { ChessPiece } from './ChessPiece';

interface CapturedPiecesProps {
  pieces: PieceType[];
  colorOfCapturedPieces: PieceColor;
  materialAdvantage?: number;
}

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({
  pieces,
  colorOfCapturedPieces,
  materialAdvantage,
}) => {
  const piecePriority: Record<string, number> = {
    q: 9, r: 5, b: 3, n: 3, p: 1, k: 0,
  };

  const sortedPieces = [...pieces].sort((a, b) => piecePriority[b] - piecePriority[a]);

  const pieceCounts: Record<string, number> = {};
  const pieceItems = sortedPieces.map(piece => {
    pieceCounts[piece] = (pieceCounts[piece] || 0) + 1;
    return {
      piece,
      key: `${colorOfCapturedPieces}-${piece}-${pieceCounts[piece]}`,
    };
  });

  const isWhite = colorOfCapturedPieces === 'w';

  return (
    <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
      <div className="flex items-center -space-x-1.5 sm:-space-x-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {pieceItems.map(({ piece, key }, idx) => (
            <motion.div
              key={key}
              layout
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
              className="relative"
            >
              <ChessPiece
                piece={{ type: piece as 'p' | 'n' | 'b' | 'r' | 'q' | 'k', color: isWhite ? 'b' : 'w' }}
                pieceTheme="classic"
                isSelected={false}
                isLastMove={false}
                isCheck={false}
                isLegalMove={false}
                isCaptureTarget={false}
                onClick={() => {}}
                className="w-8 h-8 sm:w-10 sm:h-10"
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {(materialAdvantage !== undefined && materialAdvantage !== 0) && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${materialAdvantage > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}
        >
          {materialAdvantage > 0 ? '+' : ''}{materialAdvantage}
        </motion.span>
      )}
    </div>
  );
};