import { Chess } from 'chess.js';
import { puzzleFromLichess } from './lichessPuzzle';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`);
  }
}

// Shape of https://lichess.org/api/puzzle/daily: the game up to the puzzle, solution in UCI.
const sample = {
  game: { pgn: 'e4 e5 Bc4 Nc6 Qh5 Nf6' },
  puzzle: { id: 'Ab1Cd', rating: 812, themes: ['mateIn1', 'short'], solution: ['h5f7'], initialPly: 5 },
};
const p = puzzleFromLichess(sample);
check('builds the puzzle position from the game', p !== null && p.fen === new Chess('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4').fen());
check('the solver is the side to move', p?.playerColor === 'w');
check('the solution is converted to SAN', p?.solutionMoves.join(' ') === 'Qxf7#');
check('keeps the Lichess id, rating and link', p?.id === 'Ab1Cd' && p?.rating === 812 && p?.url === 'https://lichess.org/training/Ab1Cd');

const longer = { ...sample, game: { pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#' } };
check('falls back to initialPly when the PGN runs past the puzzle start', puzzleFromLichess(longer)?.solutionMoves[0] === 'Qxf7#');

check('rejects a solution that is illegal in the position', puzzleFromLichess({ ...sample, puzzle: { ...sample.puzzle, solution: ['a1a8'] } }) === null);
check('rejects a response without a game', puzzleFromLichess({ puzzle: sample.puzzle }) === null);
check('rejects a response without a solution', puzzleFromLichess({ game: sample.game, puzzle: { id: 'x' } }) === null);

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
