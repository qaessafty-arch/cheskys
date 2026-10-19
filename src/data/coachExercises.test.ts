import { Chess } from 'chess.js';
import { TRAINING_EXERCISES } from './coachExercises';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`PASS: ${name}`);
  } else {
    failed++;
    console.log(`FAIL: ${name}${detail ? ` (${detail})` : ''}`);
  }
}

const ids = new Set<string>();
for (const ex of TRAINING_EXERCISES) {
  check(`${ex.id}: id is unique`, !ids.has(ex.id));
  ids.add(ex.id);

  let game: Chess;
  try {
    game = new Chess(ex.fen);
  } catch (e: any) {
    check(`${ex.id}: FEN is a legal position`, false, e.message);
    continue;
  }
  let illegal = '';
  for (const san of ex.solution) {
    try {
      game.move(san);
    } catch {
      illegal = san;
      break;
    }
  }
  check(`${ex.id}: every solution move is legal`, !illegal, illegal && `illegal move ${illegal}`);
  const last = ex.solution[ex.solution.length - 1];
  if (!illegal && last.endsWith('#')) check(`${ex.id}: final move is checkmate`, game.isCheckmate());
  check(`${ex.id}: has a hint`, !!ex.hint);
}

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
