/**
 * Recognises what kind of mistake a move was, from the position, the move played,
 * the engine's best move and the engine's best reply to the move played.
 *
 * Every label is decided by board facts (a capture that wins material, a piece
 * attacking two targets, a forced mate) rather than guessed from the score, so the
 * coach never names a tactic that is not on the board. Anything that does not fit
 * a pattern falls back to a plain "the engine preferred..." explanation.
 */
import { Chess, Color, PieceSymbol, Square } from 'chess.js';

export type MistakeMotif =
  | 'allowed_mate'
  | 'missed_mate'
  | 'hanging_piece'
  | 'allowed_fork'
  | 'missed_fork'
  | 'missed_material'
  | 'positional';

export interface MoveFacts {
  /** Position before the move, with the player to move. */
  fenBefore: string;
  playedUci: string;
  /** Engine's best line from `fenBefore`, in UCI (first move = best move). */
  bestLine: string[];
  /** Engine's best line after the move played (opponent to move), in UCI. */
  replyLine: string[];
  /** Mate distance for the player before the move (positive: the player mates). */
  mateBefore: number | null;
  /** Mate distance for the opponent after the move (positive: the opponent mates). */
  mateAfter: number | null;
}

export interface Diagnosis {
  motif: MistakeMotif;
  /** Plain explanation in neutral wording, ready for the coach to say. */
  explanation: string;
  /** Short label such as "Hanging piece". */
  label: string;
  playedSan: string;
  bestSan: string | null;
  /** Best line in SAN, at most six plies. */
  bestLineSan: string[];
  /** Opponent's punishing line in SAN, at most six plies. */
  replyLineSan: string[];
  /** Back-rank detail for mates delivered on the first or last rank. */
  backRank?: boolean;
}

export const MOTIF_LABELS: Record<MistakeMotif, string> = {
  allowed_mate: 'Allowed checkmate',
  missed_mate: 'Missed checkmate',
  hanging_piece: 'Hanging piece',
  allowed_fork: 'Allowed a fork',
  missed_fork: 'Missed a fork',
  missed_material: 'Missed free material',
  positional: 'Better move available',
};

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const SIDE: Record<Color, string> = { w: 'White', b: 'Black' };

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** Plays a UCI move on `game`; returns the move or null if it is not legal. */
function playUci(game: Chess, uci: string) {
  try {
    return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
  } catch {
    return null;
  }
}

/** Converts a UCI line to SAN, stopping at the first illegal move. */
export function lineToSan(fen: string, line: string[], max = 6): string[] {
  const game = new Chess(fen);
  const out: string[] = [];
  for (const uci of line.slice(0, max)) {
    const move = playUci(game, uci);
    if (!move) break;
    out.push(move.san);
  }
  return out;
}

/** Cheapest value among `color`'s pieces attacking `square`, or null if none. */
function cheapestAttacker(game: Chess, square: Square, color: Color): number | null {
  const values = game.attackers(square, color).map(sq => VALUE[game.get(sq)!.type]);
  return values.length ? Math.min(...values) : null;
}

export interface ForkInfo {
  forker: PieceSymbol;
  square: Square;
  targets: { type: PieceSymbol; square: Square }[];
}

/**
 * After a move, does the piece that moved attack two worthwhile targets at once
 * (the king, a more valuable piece, or an unprotected one) from a square where it
 * cannot simply be taken for profit?
 */
export function findFork(fenBefore: string, uci: string): ForkInfo | null {
  const game = new Chess(fenBefore);
  const move = playUci(game, uci);
  if (!move) return null;
  const color = move.color;
  const enemy = other(color);
  const square = move.to as Square;
  const forker = (move.promotion ?? move.piece) as PieceSymbol;

  // The forking piece must survive: unattacked, or only attacked by pieces worth at least as much while defended.
  const cheapestHit = cheapestAttacker(game, square, enemy);
  if (cheapestHit !== null && !(game.isAttacked(square, color) && cheapestHit >= VALUE[forker])) return null;

  const targets: ForkInfo['targets'] = [];
  for (const row of game.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== enemy) continue;
      if (!game.attackers(cell.square, color).includes(square)) continue;
      const worthIt =
        cell.type === 'k' ||
        VALUE[cell.type] > VALUE[forker] ||
        (cell.type !== 'p' && !game.isAttacked(cell.square, enemy));
      if (worthIt) targets.push({ type: cell.type, square: cell.square });
    }
  }
  if (targets.length < 2) return null;
  targets.sort((a, b) => VALUE[b.type] - VALUE[a.type]);
  return { forker, square, targets };
}

export interface WinningCapture {
  capturer: PieceSymbol;
  victim: PieceSymbol;
  square: Square;
  /** True when nothing can take back on that square. */
  unprotected: boolean;
}

/** Is `uci` a capture that wins material outright (victim unprotected, or worth more than the capturer)? */
export function winningCapture(fenBefore: string, uci: string): WinningCapture | null {
  const game = new Chess(fenBefore);
  const move = playUci(game, uci);
  if (!move || !move.captured) return null;
  const capturer = (move.promotion ?? move.piece) as PieceSymbol;
  const victim = move.captured as PieceSymbol;
  const square = move.to as Square;
  const unprotected = !game.isAttacked(square, other(move.color));
  if (!unprotected && VALUE[victim] <= VALUE[capturer]) return null;
  return { capturer, victim, square, unprotected };
}

/** Did the mate in `line` end with a rook or queen checking a king stuck on its back rank? */
function isBackRankMate(fen: string, line: string[]): boolean {
  const game = new Chess(fen);
  let last = null;
  for (const uci of line) {
    last = playUci(game, uci);
    if (!last) return false;
    if (game.isCheckmate()) break;
  }
  if (!last || !game.isCheckmate()) return false;
  const matedColor = game.turn();
  const backRank = matedColor === 'w' ? '1' : '8';
  const kingSquare = game.board().flat().find(c => c && c.type === 'k' && c.color === matedColor)?.square;
  return !!kingSquare && kingSquare[1] === backRank && last.to[1] === backRank && (last.piece === 'r' || last.piece === 'q');
}

const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const lineText = (san: string[]) => san.join(' ');

export function diagnose(facts: MoveFacts): Diagnosis {
  const before = new Chess(facts.fenBefore);
  const me = before.turn();
  const them = other(me);
  const after = new Chess(facts.fenBefore);
  const played = playUci(after, facts.playedUci);
  if (!played) throw new Error(`Illegal move ${facts.playedUci} in ${facts.fenBefore}`);
  const fenAfter = after.fen();

  const bestUci = facts.bestLine[0] ?? null;
  const bestLineSan = lineToSan(facts.fenBefore, facts.bestLine);
  const replyLineSan = lineToSan(fenAfter, facts.replyLine);
  const bestSan = bestLineSan[0] ?? null;
  const base = { playedSan: played.san, bestSan, bestLineSan, replyLineSan };
  const make = (motif: MistakeMotif, explanation: string, extra: Partial<Diagnosis> = {}): Diagnosis => ({
    motif,
    label: MOTIF_LABELS[motif],
    explanation,
    ...base,
    ...extra,
  });

  // 1. The move walks into a forced mate.
  if (facts.mateAfter !== null && facts.mateAfter > 0 && facts.replyLine.length > 0) {
    const backRank = isBackRankMate(fenAfter, facts.replyLine.slice(0, facts.mateAfter * 2 - 1));
    const n = facts.mateAfter;
    return make(
      'allowed_mate',
      `After ${played.san}, ${SIDE[them]} has mate in ${n}: ${lineText(lineToSan(fenAfter, facts.replyLine, n * 2 - 1))}.` +
        (backRank ? ' Your king was trapped on its back rank with no escape square.' : ' Check every forcing move your opponent has before you move.'),
      { backRank }
    );
  }

  // 2. A forced mate was on the board and the move played does not keep it.
  if (facts.mateBefore !== null && facts.mateBefore > 0 && bestSan && !(after.isCheckmate())) {
    const n = facts.mateBefore;
    const keepsMate = facts.mateAfter !== null && facts.mateAfter < 0;
    if (!keepsMate) {
      return make('missed_mate', `You had mate in ${n}: ${lineText(lineToSan(facts.fenBefore, facts.bestLine, n * 2 - 1))}. Look for checks first: they are the most forcing moves.`);
    }
  }

  const reply = facts.replyLine[0];
  // 3. The opponent can now win material with a capture.
  if (reply) {
    const capture = winningCapture(fenAfter, reply);
    if (capture) {
      const wasMoved = capture.square === played.to;
      const why = capture.unprotected
        ? 'with nothing defending it'
        : `where a ${NAME[capture.capturer]} (worth less) can take it`;
      const where = wasMoved ? `${played.san} put your ${NAME[capture.victim]} on ${capture.square}` : `After ${played.san}, your ${NAME[capture.victim]} on ${capture.square} is left`;
      return make('hanging_piece', `${where} ${why}. ${SIDE[them]} wins it with ${replyLineSan[0]}.`);
    }
    // 4. The opponent's best reply is a fork.
    const fork = findFork(fenAfter, reply);
    if (fork) {
      const targets = list(fork.targets.map(t => (t.type === 'k' ? 'your king' : `your ${NAME[t.type]} on ${t.square}`)));
      return make('allowed_fork', `${played.san} allows ${replyLineSan[0]}: the ${NAME[fork.forker]} attacks ${targets} at the same time, and you can only save one.`);
    }
  }

  if (bestUci && bestUci !== facts.playedUci) {
    // 5. The best move was a fork.
    const fork = findFork(facts.fenBefore, bestUci);
    if (fork) {
      const targets = list(fork.targets.map(t => (t.type === 'k' ? 'the king' : `the ${NAME[t.type]} on ${t.square}`)));
      return make('missed_fork', `${bestSan} was a ${NAME[fork.forker]} fork, attacking ${targets} at once.`);
    }
    // 6. The best move simply won material.
    const capture = winningCapture(facts.fenBefore, bestUci);
    if (capture) {
      const why = capture.unprotected ? 'nothing was defending it' : `your ${NAME[capture.capturer]} is worth less`;
      return make('missed_material', `${bestSan} wins the ${NAME[capture.victim]} on ${capture.square}: ${why}.`);
    }
  }

  return make(
    'positional',
    bestSan
      ? `${bestSan} was stronger. The engine's line: ${lineText(bestLineSan)}.`
      : `${played.san} made your position worse.`
  );
}
