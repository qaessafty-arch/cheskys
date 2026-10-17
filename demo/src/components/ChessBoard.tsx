import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chess, Square } from 'chess.js';
import { ChessPiece } from './ChessPiece';
import { DemoSettings, PieceColor, PieceType } from '../types/chess';
import { getLegalMoves } from '../utils/chessEngine';
import { BOARD_THEMES } from '../data/demoData';
import { EvalBar } from './EvalBar';

interface ChessBoardProps {
  game: Chess;
  orientation: 'w' | 'b';
  settings: DemoSettings;
  lastMove?: { from: string; to: string } | null;
  selectedSquare: Square | null;
  onSquareClick: (square: Square) => void;
  disabled?: boolean;
  checkSquare?: Square | null;
  evalScore?: number | null;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export const ChessBoard: React.FC<ChessBoardProps> = ({
  game,
  orientation,
  settings,
  lastMove,
  selectedSquare,
  onSquareClick,
  disabled = false,
  checkSquare,
  evalScore,
}) => {
  const theme = useMemo(() => BOARD_THEMES.find(t => t.id === settings.boardTheme) || BOARD_THEMES[0], [settings.boardTheme]);

  const squares = useMemo(() => {
    const board = game.board();
    const squares: Array<{
      square: Square;
      piece: { type: PieceType; color: PieceColor } | null;
      isLight: boolean;
      isSelected: boolean;
      isLastMove: boolean;
      isCheck: boolean;
      isLegalMove: boolean;
      isCaptureTarget: boolean;
    }> = [];

    const legalMoves = selectedSquare ? getLegalMoves(game, selectedSquare) : [];

    for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
      for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
        const file = FILES[fileIdx];
        const rank = RANKS[7 - rankIdx];
        const square = `${file}${rank}` as Square;
        const boardRank = orientation === 'w' ? 7 - rankIdx : rankIdx;
        const boardFile = orientation === 'w' ? fileIdx : 7 - fileIdx;
        const piece = board[boardRank]?.[boardFile] || null;
        const isLight = (rankIdx + fileIdx) % 2 === 0;
        const isSelectedSquare = selectedSquare === square;
        const isLastMoveSquare = lastMove?.from === square || lastMove?.to === square;
        const isCheckSquare = checkSquare === square;
        const isLegalMoveSquare = legalMoves.includes(square);
        const targetPiece = game.get(square as Square);
        const isCaptureTargetSquare = isLegalMoveSquare && !!targetPiece && targetPiece.color !== game.turn();

        squares.push({
          square,
          piece: piece ? { type: piece.type as PieceType, color: piece.color as PieceColor } : null,
          isLight,
          isSelected: isSelectedSquare,
          isLastMove: isLastMoveSquare,
          isCheck: isCheckSquare,
          isLegalMove: isLegalMoveSquare,
          isCaptureTarget: isCaptureTargetSquare,
        });
      }
    }
    return squares;
  }, [game, orientation, selectedSquare, lastMove, checkSquare, settings.boardTheme]);

  const handleSquareClick = useCallback((square: Square) => {
    if (disabled) return;
    onSquareClick(square);
  }, [disabled, onSquareClick]);

  const boardStyle = {
    backgroundColor: theme.dark,
    border: `4px solid ${theme.border}`,
    boxShadow: `0 0 40px ${theme.glow}, 0 20px 60px rgba(0,0,0,0.6)`,
    transform: settings.is3dPerspective ? 'perspective(1000px) rotateX(15deg)' : 'none',
    transformStyle: 'preserve-3d',
  } as React.CSSProperties;

  return (
    <div className="relative flex flex-col items-center w-full">
      <div
        className="relative aspect-square w-full max-w-[560px] rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        style={boardStyle}
        role="grid"
        aria-label="Chess board"
      >
        <AnimatePresence mode="popLayout">
          {squares.map((sq, idx) => (
            <motion.button
              key={sq.square}
              onClick={() => handleSquareClick(sq.square)}
              disabled={disabled}
              className="relative flex-1 flex items-center justify-center select-none"
              style={{
                width: '12.5%',
                height: '12.5%',
                backgroundColor: sq.isLight ? theme.light : theme.dark,
                position: 'absolute',
                left: `${(idx % 8) * 12.5}%`,
                top: `${Math.floor(idx / 8) * 12.5}%`,
              }}
              whileTap={{ scale: 0.98 }}
              aria-label={sq.square}
              data-square={sq.square}
            >
              <ChessPiece
                piece={sq.piece}
                pieceTheme={settings.pieceTheme}
                isSelected={sq.isSelected}
                isLastMove={sq.isLastMove && settings.highlightLastMove}
                isCheck={sq.isCheck}
                isLegalMove={sq.isLegalMove && settings.showLegalMoves}
                isCaptureTarget={sq.isCaptureTarget}
              />
              {settings.showCoordinates && (
                <>
                  {(sq.square[1] === '1' || sq.square[1] === '8') && (
                    <span
                      className="absolute text-[10px] font-mono font-bold select-none pointer-events-none"
                      style={{
                        color: sq.isLight ? theme.darkText : theme.lightText,
                        bottom: '2px',
                        right: '4px',
                      }}
                    >
                      {sq.square[0]}
                    </span>
                  )}
                  {(sq.square[0] === 'a' || sq.square[0] === 'h') && (
                    <span
                      className="absolute text-[10px] font-mono font-bold select-none pointer-events-none"
                      style={{
                        color: sq.isLight ? theme.darkText : theme.lightText,
                        top: '2px',
                        left: '4px',
                      }}
                    >
                      {sq.square[1]}
                    </span>
                  )}
                </>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Kurdistan flag stripe under the UKH board: a clean accent, no artwork on the squares */}
      {settings.boardTheme === 'ukh' && (
        <div className="w-full max-w-[560px] h-1.5 mt-2 rounded-full overflow-hidden flex" aria-hidden="true">
          <span className="flex-1 bg-[#ED1C24]" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-[#278E43]" />
        </div>
      )}

      {evalScore != null && (
        <EvalBar score={evalScore} isFlipped={orientation === 'b'} className="w-full max-w-[560px] h-3 mt-2" />
      )}
    </div>
  );
};
