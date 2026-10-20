import { doc, getDoc, collection, getDocs, increment, query, orderBy, limit } from 'firebase/firestore';
import { db, safeSetDoc, safeDeleteDoc, safeUpdateDoc } from '../utils/firebase';
import { AuthoredPuzzle, PieceColor } from '../types/chess';
import { Chess } from 'chess.js';
import { VERIFIED_PUZZLES } from '../data/verifiedPuzzles';

const LOCAL_STORAGE_KEY = 'chesskys_authored_puzzles';

// Example puzzles shown in the authoring view, taken from the engine-checked set.
const TEMPLATE_SOURCE_IDS = ['game-opera-1858', 'game-evergreen-1852', 'game-rotlewi-rubinstein-1907'];
const TEMPLATE_DIFFICULTY = (rating: number): AuthoredPuzzle['difficulty'] =>
  rating <= 1000 ? 'Easy' : rating <= 1500 ? 'Medium' : rating <= 2000 ? 'Hard' : 'Master';

export const DEFAULT_AUTHORED_TEMPLATES: AuthoredPuzzle[] = TEMPLATE_SOURCE_IDS
  .map(id => VERIFIED_PUZZLES.find(p => p.id === id)!)
  .map(p => ({
    id: `template-${p.id}`,
    title: p.title,
    description: p.game ? `${p.description} ${p.game.white} – ${p.game.black}, ${p.game.event} ${p.game.year}.` : p.description,
    theme: p.theme,
    difficulty: TEMPLATE_DIFFICULTY(p.rating),
    rating: p.rating,
    fen: p.fen,
    playerColor: p.playerColor,
    solutionMoves: p.solutionMoves,
    hints: [p.tip],
    authorUid: 'chesskys',
    authorName: 'Chesskys',
    authorBadge: '♟️',
    createdAt: '2026-10-20T00:00:00.000Z',
    likesCount: 0,
    solvesCount: 0,
    isPublished: true
  }));

/** Built-in templates always come from the current list; the player's own puzzles are kept. */
const withCurrentTemplates = (stored: AuthoredPuzzle[]): AuthoredPuzzle[] => [
  ...DEFAULT_AUTHORED_TEMPLATES,
  ...stored.filter(p => !String(p.id).startsWith('template-'))
];

export function getLocalAuthoredPuzzles(): AuthoredPuzzle[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_AUTHORED_TEMPLATES));
      return DEFAULT_AUTHORED_TEMPLATES;
    }
    const parsed: AuthoredPuzzle[] = JSON.parse(raw);
    return Array.isArray(parsed) ? withCurrentTemplates(parsed) : DEFAULT_AUTHORED_TEMPLATES;
  } catch (e) {
    console.error('Failed to load authored puzzles from localStorage:', e);
    return DEFAULT_AUTHORED_TEMPLATES;
  }
}

export function saveLocalAuthoredPuzzles(puzzles: AuthoredPuzzle[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(puzzles));
  } catch (e) {
    console.error('Failed to save authored puzzles to localStorage:', e);
  }
}

export async function fetchCloudAuthoredPuzzles(): Promise<AuthoredPuzzle[]> {
  try {
    const coll = collection(db, 'authored_puzzles');
    const q = query(coll, orderBy('createdAt', 'desc'), limit(40));
    const snap = await getDocs(q);
    const results: AuthoredPuzzle[] = [];
    snap.forEach(docSnap => {
      results.push(docSnap.data() as AuthoredPuzzle);
    });
    return results;
  } catch (err) {
    console.warn('Could not fetch cloud authored puzzles, using local storage:', err);
    return [];
  }
}

export async function saveAuthoredPuzzle(puzzle: AuthoredPuzzle): Promise<void> {
  // 1. Save locally
  const current = getLocalAuthoredPuzzles();
  const existingIdx = current.findIndex(p => p.id === puzzle.id);
  let updatedList: AuthoredPuzzle[];
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = puzzle;
  } else {
    updatedList = [puzzle, ...current];
  }
  saveLocalAuthoredPuzzles(updatedList);

  // 2. Sync to Firestore if published
  try {
    const ref = doc(db, 'authored_puzzles', puzzle.id);
    await safeSetDoc(ref, puzzle, { merge: true });
  } catch (err) {
    console.warn('Cloud puzzle save failed (offline or guest):', err);
  }
}

export async function deleteAuthoredPuzzle(puzzleId: string): Promise<void> {
  const current = getLocalAuthoredPuzzles();
  const filtered = current.filter(p => p.id !== puzzleId);
  saveLocalAuthoredPuzzles(filtered);

  try {
    const ref = doc(db, 'authored_puzzles', puzzleId);
    await safeDeleteDoc(ref);
  } catch (err) {
    console.warn('Cloud puzzle delete failed:', err);
  }
}

export async function likeAuthoredPuzzle(puzzleId: string): Promise<void> {
  // Update local
  const current = getLocalAuthoredPuzzles();
  const found = current.find(p => p.id === puzzleId);
  if (found) {
    found.likesCount = (found.likesCount || 0) + 1;
    saveLocalAuthoredPuzzles(current);
  }

  // Update cloud
  try {
    const ref = doc(db, 'authored_puzzles', puzzleId);
    await safeUpdateDoc(ref, {
      likesCount: increment(1)
    });
  } catch (e) {
    console.warn('Could not update like count in cloud:', e);
  }
}

export async function recordPuzzleSolve(puzzleId: string): Promise<void> {
  const current = getLocalAuthoredPuzzles();
  const found = current.find(p => p.id === puzzleId);
  if (found) {
    found.solvesCount = (found.solvesCount || 0) + 1;
    saveLocalAuthoredPuzzles(current);
  }

  try {
    const ref = doc(db, 'authored_puzzles', puzzleId);
    await safeUpdateDoc(ref, {
      solvesCount: increment(1)
    });
  } catch (e) {
    console.warn('Could not update solve count in cloud:', e);
  }
}

export function validateFen(fen: string): { valid: boolean; error?: string } {
  try {
    const chess = new Chess(fen);
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid FEN notation format' };
  }
}

export function validateSolutionMoves(fen: string, moves: string[]): { valid: boolean; error?: string } {
  try {
    const chess = new Chess(fen);
    for (let i = 0; i < moves.length; i++) {
      const san = moves[i].trim();
      if (!san) continue;
      const res = chess.move(san);
      if (!res) {
        return { valid: false, error: `Illegal move #${i + 1} "${san}" from position FEN: ${chess.fen()}` };
      }
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Failed to simulate move sequence' };
  }
}
