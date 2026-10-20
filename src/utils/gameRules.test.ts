import { Chess } from 'chess.js';
import { cloneGame, drawReason, canStillMate, pgnWithHeaders } from './gameRules';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`);
  }
}

const rep = new Chess();
for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1']) rep.move(m);
const next = cloneGame(rep);
next.move('Ng8');
check('a copied game still detects threefold repetition', next.isThreefoldRepetition());
check('the repetition is named', drawReason(next) === 'Draw by threefold repetition.');

const custom = new Chess('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
custom.move('e4');
check('a copy keeps a custom starting position', cloneGame(custom).fen() === custom.fen());

check('stalemate is named', drawReason(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')) === 'Draw by stalemate.');
check('insufficient material is named', drawReason(new Chess('7k/8/8/8/8/8/8/K6B w - - 0 1')) === 'Draw by insufficient material.');
check('the fifty-move rule is named', drawReason(new Chess('7k/8/8/8/8/8/1R6/K7 w - - 100 80')) === 'Draw by the fifty-move rule.');

check('a lone king cannot mate', !canStillMate(new Chess('7k/8/8/8/8/8/8/K6R w - - 0 1'), 'b'));
check('king and knight cannot mate a lone king', !canStillMate(new Chess('7k/8/8/8/8/8/8/K5N1 w - - 0 1'), 'w'));
check('king and rook can mate', canStillMate(new Chess('7k/8/8/8/8/8/8/K5R1 w - - 0 1'), 'w'));
check('king and knight can still mate when the opponent has pawns', canStillMate(new Chess('7k/6p1/8/8/8/8/8/K5N1 w - - 0 1'), 'w'));
check('a single pawn can still win', canStillMate(new Chess('7k/8/8/8/8/8/P7/K7 w - - 0 1'), 'w'));

const scholar = new Chess();
for (const m of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']) scholar.move(m);
const pgn = pgnWithHeaders(scholar, { white: 'Hana', black: 'Zagros Scout', result: '1-0', date: new Date(2026, 9, 20) });
check('exported PGN names the players', pgn.includes('[White "Hana"]') && pgn.includes('[Black "Zagros Scout"]'));
check('exported PGN has the date and result', pgn.includes('[Date "2026.10.20"]') && pgn.includes('[Result "1-0"]'));
check('exported PGN contains every move and ends with the result', pgn.includes('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0'));
const reread = new Chess();
reread.loadPgn(pgn);
check('exported PGN loads back to the same position', reread.fen() === scholar.fen());

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
