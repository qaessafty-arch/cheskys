import { Chess } from 'chess.js';
import { VERIFIED_PUZZLES } from './verifiedPuzzles';
import { PUZZLES_COLLECTION } from '../utils/puzzles';
import { EXTENDED_PUZZLES } from '../utils/puzzleDatabase';
import { DAILY_PUZZLES_ARCHIVE } from '../utils/dailyPuzzles';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail ? ` (${detail})` : ''}`);
  }
}

const ids = new Set<string>();
const fens = new Set<string>();
for (const p of VERIFIED_PUZZLES) {
  check(`${p.id}: unique id`, !ids.has(p.id));
  ids.add(p.id);
  check(`${p.id}: unique position`, !fens.has(p.fen));
  fens.add(p.fen);

  let g: Chess;
  try {
    g = new Chess(p.fen);
  } catch (e: any) {
    check(`${p.id}: legal FEN`, false, e.message);
    continue;
  }
  check(`${p.id}: the solver is the side to move`, g.turn() === p.playerColor);

  let illegal = '';
  p.solutionMoves.forEach((san, i) => {
    if (illegal) return;
    try {
      const m = g.move(san);
      check(`${p.id}: move ${i + 1} written as chess.js writes it`, m.san === san, `${san} vs ${m.san}`);
    } catch {
      illegal = san;
    }
  });
  check(`${p.id}: every solution move is legal`, !illegal, illegal);
  check(`${p.id}: the solver makes the last move`, p.solutionMoves.length % 2 === 1);
  const last = p.solutionMoves[p.solutionMoves.length - 1];
  check(`${p.id}: '#' appears exactly when the line ends in mate`, last.endsWith('#') === g.isCheckmate());
  if (/^Mate in (\d)/.test(p.category)) {
    const n = Number(p.category.match(/\d/)![0]);
    check(`${p.id}: '${p.category}' really mates in ${n}`, g.isCheckmate() && p.solutionMoves.length === 2 * n - 1);
  }
  check(`${p.id}: has an explanation and a tip`, p.explanation.length > 20 && p.tip.length > 10);
  check(`${p.id}: rating in a sensible range`, p.rating >= 400 && p.rating <= 2800);
  if (p.game) check(`${p.id}: game source is complete`, !!(p.game.white && p.game.black && p.game.event && p.game.year > 1700));
}

check('the puzzle collection uses every verified puzzle', PUZZLES_COLLECTION.length === VERIFIED_PUZZLES.length);
check('the practice set uses every verified puzzle', EXTENDED_PUZZLES.length === VERIFIED_PUZZLES.length);
check('the daily rotation uses every verified puzzle', DAILY_PUZZLES_ARCHIVE.length === VERIFIED_PUZZLES.length);
for (const cat of ['Mate in 1', 'Mate in 2', 'Fork', 'Pin', 'Skewer', 'Deflection', 'Sacrifice', 'Endgame']) {
  check(`practice has at least one '${cat}' puzzle`, EXTENDED_PUZZLES.some(p => p.category === cat));
}

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
