import { Chess } from 'chess.js';
import { OPENINGS_DATABASE, detectOpening } from './openings';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}${detail ? ` (${detail})` : ''}`);
  }
}

const seen = new Set<string>();
for (const entry of OPENINGS_DATABASE) {
  const label = `${entry.name}${entry.variation ? `: ${entry.variation}` : ''} [${entry.moves.join(' ')}]`;
  const g = new Chess();
  let illegal = '';
  for (const m of entry.moves) {
    try { g.move(m); } catch { illegal = m; break; }
  }
  check(`${label} is a legal line`, !illegal, illegal && `illegal move ${illegal}`);
  check(`${label} has an ECO code`, /^[A-E]\d\d$/.test(entry.eco), entry.eco);
  const key = entry.moves.join(' ');
  check(`${label} is not listed twice`, !seen.has(key));
  seen.add(key);
  check(`${label} is detected as itself`, detectOpening(entry.moves)?.name === entry.name);
}

check('a deeper line keeps the most specific name', detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4'])?.variation === 'Morphy Defense');
check('1.e4 e5 2.Nf3 Nc6 3.Bc4 is not called the Giuoco Piano', !detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])?.variation);
check('an unlisted 1.e4 e5 line falls back to the King’s Pawn Game', detectOpening(['e4', 'e5', 'Qh5'])?.eco === 'C20');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
