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

const UKH_WATERMARK = (
  <svg viewBox="0 0 500 500" className="w-full h-full" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="ukh-stripes" patternUnits="userSpaceOnUse" width="500" height="500" patternTransform="rotate(45)">
        <rect x="0" y="0" width="500" height="166.67" fill="#E41E20" />
        <rect x="0" y="166.67" width="500" height="166.67" fill="#FFFFFF" />
        <rect x="0" y="333.33" width="500" height="166.67" fill="#278E43" />
      </pattern>
    </defs>
    <rect width="500" height="500" fill="url(#ukh-stripes)" />
    <g transform="translate(250, 250)">
      <circle r="70" fill="#FFD100" opacity="0.3" />
      {Array.from({ length: 21 }).map((_, i) => (
        <path
          key={i}
          d="M 0 -100 L 10 -65 L -10 -65 Z"
          fill="#FFD100"
          opacity="0.4"
          transform={`rotate(${(i * 360) / 21})`}
        />
      ))}
      <circle r="35" fill="#FFD100" opacity="0.5" />
    </g>
  </svg>
);

const PESHMERGA_WATERMARK = (
  <svg viewBox="0 0 500 500" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="peshmerga-sun" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFE082" />
        <stop offset="100%" stopColor="#F5C453" />
      </radialGradient>
    </defs>
    <g transform="translate(250, 250)">
      <circle r="80" fill="url(#peshmerga-sun)" opacity="0.25" />
      {Array.from({ length: 21 }).map((_, i) => (
        <path
          key={i}
          d="M 0 -120 L 12 -75 L -12 -75 Z"
          fill="#F5C453"
          opacity="0.3"
          transform={`rotate(${(i * 360) / 21})`}
        />
      ))}
      <circle r="40" fill="#F5C453" opacity="0.3" />
    </g>
  </svg>
);

const AOT_WATERMARK = (
  <svg viewBox="0 0 500 500" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="aot-wings" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#4ADE80" />
        <stop offset="100%" stopColor="#15803D" />
      </radialGradient>
    </defs>
    <g transform="translate(250, 250) scale(0.8)">
      <path d="M 0 -120 L -30 -40 L -20 -40 L -20 20 L -10 20 L -10 80 L 10 80 L 10 20 L 20 20 L 20 -40 L 30 -40 Z" fill="#15803D" opacity="0.25" />
      <path d="M 0 -120 L 30 -40 L 20 -40 L 20 20 L 10 20 L 10 80 L -10 80 L -10 20 L -20 20 L -20 -40 L -30 -40 Z" fill="#15803D" opacity="0.2" />
      <ellipse cx="0" cy="-20" rx="30" ry="15" fill="#4ADE80" opacity="0.3" />
    </g>
  </svg>
);

const BATMAN_WATERMARK = (
  <svg viewBox="0 0 500 500" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="batman-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#EAB308" />
        <stop offset="100%" stopColor="#CA8A04" />
      </radialGradient>
    </defs>
    <path d="M 250 50 L 400 200 L 350 200 L 350 300 L 250 350 L 150 300 L 150 200 L 100 200 Z" fill="#1E293B" opacity="0.25" />
    <ellipse cx="250" cy="200" rx="80" ry="40" fill="#EAB308" opacity="0.15" />
    <polygon points="250,50 200,200 300,200" fill="#EAB308" opacity="0.12" />
  </svg>
);

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

  const getWatermark = () => {
    switch (settings.boardTheme) {
      case 'ukh': return UKH_WATERMARK;
      case 'peshmerga': return PESHMERGA_WATERMARK;
      case 'aot':
      case 'wall-maria': return AOT_WATERMARK;
      case 'batman':
      case 'gotham-city': return BATMAN_WATERMARK;
      default: return null;
    }
  };

  const Watermark = getWatermark();

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
        {Watermark && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-10" style={{ opacity: 0.08 }}>
            {Watermark}
          </div>
        )}

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

      {evalScore != null && (
        <EvalBar score={evalScore} isFlipped={orientation === 'b'} className="w-full max-w-[560px] h-3 mt-2" />
      )}
    </div>
  );
};
