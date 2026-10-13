import React from 'react';
import { motion } from 'motion/react';
import { PieceColor, PieceType, PieceThemeName } from '../types/chess';
import { getUkhPiece } from './pieces/UkhPieces';

const PIECE_SYMBOLS: Record<PieceType, { w: string; b: string }> = {
  p: { w: '♙', b: '♟' },
  n: { w: '♘', b: '♞' },
  b: { w: '♗', b: '♝' },
  r: { w: '♖', b: '♜' },
  q: { w: '♕', b: '♛' },
  k: { w: '♔', b: '♚' },
};

const PIECE_NAMES: Record<PieceType, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};

interface ChessPieceProps {
  piece: { type: PieceType; color: PieceColor } | null;
  pieceTheme: PieceThemeName;
  isSelected: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  isLegalMove: boolean;
  isCaptureTarget: boolean;
  onClick: () => void;
  className?: string;
}

export const ChessPiece: React.FC<ChessPieceProps> = ({
  piece,
  pieceTheme,
  isSelected,
  isLastMove,
  isCheck,
  isLegalMove,
  isCaptureTarget,
  onClick,
  className = '',
}) => {
  if (!piece) return null;

  const pieceName = PIECE_NAMES[piece.type];

  // Use UKH custom SVG pieces for 'ukh' theme
  if (pieceTheme === 'ukh') {
    return (
      <motion.button
        onClick={onClick}
        className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
        whileHover={{ scale: 1.05, zIndex: 10 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          scale: isSelected ? 1.08 : 1,
          boxShadow: isSelected
            ? '0 0 0 4px var(--selection-ring), 0 8px 24px rgba(0,0,0,0.4)'
            : isLastMove
            ? '0 0 0 3px var(--last-move), inset 0 0 20px var(--last-move)'
            : isCheck
            ? '0 0 20px var(--check-glow), 0 0 40px var(--check-glow)'
            : 'none',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        aria-label={`${piece?.color === 'w' ? 'White' : 'Black'} ${pieceName}`}
      >
        {getUkhPiece({ type: piece!.type, color: piece!.color, size: 56 })}
        {isLegalMove && !isCaptureTarget && (
          <div
            className="absolute w-2 h-2 rounded-full"
            style={{ backgroundColor: 'var(--move-marker)' }}
          />
        )}
        {isLegalMove && isCaptureTarget && (
          <div
            className="absolute border-2 rounded-[8px]"
            style={{
              width: '80%',
              height: '80%',
              borderColor: 'var(--capture-ring)',
              boxShadow: '0 0 12px var(--capture-ring)',
            }}
          />
        )}
      </motion.button>
    );
  }

  // Default Unicode pieces for other themes
  const pieceSymbol = PIECE_SYMBOLS[piece.type][piece.color];

  return (
    <motion.button
      onClick={onClick}
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
      style={{
        fontSize: 'clamp(28px, 5vw, 56px)',
        lineHeight: 1,
        color: piece.color === 'w' ? 'var(--square-dark-text)' : 'var(--square-light-text)',
        textShadow: piece.color === 'w'
          ? '0 0 4px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.3)'
          : '0 0 4px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)',
        filter: pieceTheme === 'vintage' ? 'sepia(0.4) saturate(1.2) contrast(1.1)' : 'none',
      }}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        scale: isSelected ? 1.08 : 1,
        boxShadow: isSelected
          ? '0 0 0 4px var(--selection-ring), 0 8px 24px rgba(0,0,0,0.4)'
          : isLastMove
          ? '0 0 0 3px var(--last-move), inset 0 0 20px var(--last-move)'
          : isCheck
          ? '0 0 20px var(--check-glow), 0 0 40px var(--check-glow)'
          : 'none',
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      aria-label={`${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[piece.type]}`}
    >
      {PIECE_SYMBOLS[piece.type][piece.color]}
      {isLegalMove && !isCaptureTarget && (
        <div
          className="absolute w-2 h-2 rounded-full"
          style={{ backgroundColor: 'var(--move-marker)' }}
        />
      )}
      {isLegalMove && isCaptureTarget && (
        <div
          className="absolute border-2 rounded-[8px]"
          style={{
            width: '80%',
            height: '80%',
            borderColor: 'var(--capture-ring)',
            boxShadow: '0 0 12px var(--capture-ring)',
          }}
        />
      )}
    </motion.button>
  );
};