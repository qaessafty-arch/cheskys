import { Chess, Square, Move } from 'chess.js';

export function getLegalMoves(game: Chess, square: Square): Square[] {
  const moves = game.moves({ square, verbose: true });
  return moves.map(m => m.to);
}

export function isLegalMove(game: Chess, from: Square, to: Square): boolean {
  const moves = game.moves({ square: from, verbose: true });
  return moves.some(m => m.to === to);
}

export function makeMove(game: Chess, from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): Move | null {
  try {
    return game.move({ from, to, promotion: promotion || 'q' });
  } catch {
    return null;
  }
}

export function getGameStatus(game: Chess): { status: string; winner?: 'w' | 'b' } {
  if (game.isCheckmate()) {
    return { status: 'checkmate', winner: game.turn() === 'w' ? 'b' : 'w' };
  }
  if (game.isDraw()) {
    return { status: 'draw' };
  }
  if (game.isStalemate()) {
    return { status: 'draw' };
  }
  if (game.isThreefoldRepetition()) {
    return { status: 'draw' };
  }
  if (game.insufficientMaterial()) {
    return { status: 'draw' };
  }
  return { status: 'in_progress' };
}

export function getDemoBotMove(game: Chess, difficulty: 'easy' | 'medium' | 'hard'): Move | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  switch (difficulty) {
    case 'easy':
      return moves[Math.floor(Math.random() * moves.length)];

    case 'medium': {
      // Prefer captures and center control
      const captures = moves.filter(m => m.captured);
      if (captures.length > 0 && Math.random() > 0.3) {
        return captures[Math.floor(Math.random() * captures.length)];
      }
      const centerMoves = moves.filter(m => ['e4', 'd4', 'e5', 'd5', 'c4', 'c5', 'f4', 'f5'].includes(m.to));
      if (centerMoves.length > 0 && Math.random() > 0.5) {
        return centerMoves[Math.floor(Math.random() * centerMoves.length)];
      }
      return moves[Math.floor(Math.random() * moves.length)];
    }

    case 'hard': {
      // Simple minimax depth 2
      let bestMove = moves[0];
      let bestScore = -Infinity;

      for (const move of moves) {
        const testGame = new Chess(game.fen());
        testGame.move(move);
        let score = evaluatePosition(testGame);

        // Opponent's best response
        const opponentMoves = testGame.moves({ verbose: true });
        let worstScore = Infinity;
        for (const oppMove of opponentMoves) {
          const oppGame = new Chess(testGame.fen());
          oppGame.move(oppMove);
          const oppScore = evaluatePosition(oppGame);
          worstScore = Math.min(worstScore, oppScore);
        }
        score = worstScore;

        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
      return bestMove;
    }
  }
}

function evaluatePosition(game: Chess): number {
  if (game.isCheckmate()) return game.turn() === 'w' ? -10000 : 10000;
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.insufficientMaterial()) return 0;

  const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  let score = 0;
  const board = game.board();

  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        const value = pieceValues[piece.type] || 0;
        score += piece.color === 'w' ? value : -value;
      }
    }
  }

  // Center control bonus
  const centerSquares = ['e4', 'd4', 'e5', 'd5'];
  for (const sq of centerSquares) {
    const piece = game.get(sq as Square);
    if (piece) {
      score += piece.color === 'w' ? 10 : -10;
    }
  }

  // Check bonus
  if (game.isCheck()) {
    score += game.turn() === 'w' ? -50 : 50;
  }

  return score;
}

export function formatTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatTimeLong(ms: number): string {
  if (ms <= 0) return '00:00.0';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
}

export function generateGameRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}