import { PrecisionMatchClock } from '../../server/matchmaking/preciseClock.js';
import { generateReconnectTicket, verifyReconnectTicket } from '../../server/security/reconnectToken.js';
import { MovePayloadSchema } from '../../server/schemas/moveSchema.js';
import { Chess } from 'chess.js';

let passed = 0;
let failed = 0;

function assert(title: string, condition: boolean, details?: unknown) {
  if (condition) {
    passed++;
    console.log(`PASS: ${title}`);
  } else {
    failed++;
    console.error(`FAIL: ${title}`, details);
  }
}

async function runTests() {
  console.log('--- RUNNING CHESSKYS PHASE 1 HARDENED INTEGRATION TESTS ---');

  // 1. Test PrecisionMatchClock
  let flagCaught = false;
  const clock = new PrecisionMatchClock(1, 0, (flagged) => {
    flagCaught = true;
  });
  clock.start();
  
  const snap1 = clock.getSnapshot();
  assert('Clock initializes with 1000ms for white', snap1.whiteMs >= 950 && snap1.whiteMs <= 1000);
  assert('Active color is white', snap1.activeColor === 'w');

  // Switch turn with 100ms simulated RTT (50ms lag deduction)
  const snap2 = clock.switchTurn(100);
  assert('Turn switched to black', snap2.activeColor === 'b');
  assert('Black has initial time', snap2.blackMs >= 950);
  clock.destroy();

  // 2. Test MovePayloadSchema (SEC-01)
  const validPayload = {
    matchId: 'match-123',
    from: 'e2',
    to: 'e4',
    clientTimestamp: Date.now(),
  };
  const parseValid = MovePayloadSchema.safeParse(validPayload);
  assert('Valid move payload passes Zod validation', parseValid.success);

  const maliciousPayload = {
    matchId: 'match-123',
    from: 'e2',
    to: 'e9', // illegal square coordinate
  };
  const parseMalicious = MovePayloadSchema.safeParse(maliciousPayload);
  assert('Malicious out-of-board coordinate rejected by Zod', !parseMalicious.success);

  // 3. Test Reconnect Tickets (CK-104)
  const ticket = generateReconnectTicket('match-456', 'user-abc', 'w', 12);
  assert('Generated ticket is a valid string', typeof ticket === 'string' && ticket.length > 20);

  const verified = verifyReconnectTicket(ticket);
  assert('Verified ticket contains correct matchId', verified?.matchId === 'match-456');
  assert('Verified ticket contains correct color', verified?.color === 'w');
  assert('Verified ticket contains correct sequence', verified?.seq === 12);

  const tamperedTicket = ticket.slice(0, -4) + 'abcd';
  const badVerified = verifyReconnectTicket(tamperedTicket);
  assert('Tampered ticket fails HMAC signature verification', badVerified === null);

  // 4. Test Chess Rule Edge Cases (DEV-01)
  // En Passant
  const chessEp = new Chess();
  chessEp.move('e4');
  chessEp.move('a6');
  chessEp.move('e5');
  chessEp.move('d5'); // triggers d6 as en passant target
  const epMove = chessEp.move({ from: 'e5', to: 'd6' });
  assert('En passant capture valid', epMove !== null && epMove.san === 'exd6');
  assert('Captured pawn removed from d5', !chessEp.get('d5'));

  // Threefold repetition
  const chessTfr = new Chess();
  chessTfr.move('Nf3'); chessTfr.move('Nf6');
  chessTfr.move('Ng1'); chessTfr.move('Ng8');
  chessTfr.move('Nf3'); chessTfr.move('Nf6');
  chessTfr.move('Ng1'); chessTfr.move('Ng8');
  assert('Threefold repetition detected', chessTfr.isThreefoldRepetition() === true);

  // Stalemate
  const chessStale = new Chess('k7/8/1Q6/8/8/8/8/7K b - - 0 1');
  assert('Stalemate recognized when king has no legal moves and not in check', 
    !chessStale.inCheck() && chessStale.isStalemate() && chessStale.isGameOver()
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
