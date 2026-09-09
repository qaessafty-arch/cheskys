import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, safeSetDoc } from '../utils/firebase';
import { OnlineMatchPlayer, OnlineMatchSession, TimeControl } from '../types/chess';
import { normalizeRoomCode } from '../utils/roomResolver';

export interface CreateMatchParams {
  hostPlayer: OnlineMatchPlayer;
  opponentPlayer?: OnlineMatchPlayer | null;
  timeControl: TimeControl;
  colorPreference?: 'white' | 'black' | 'random' | 'w' | 'b';
  roomCode?: string;
  gameId?: string;
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Strict Handshake Protocol Match Creator
 * ONLY called by the Creator/Host of the room.
 * Atomically initializes online_matches/{gameId} with verified starting FEN,
 * strict whiteId/blackId mappings based on room settings, and initial clocks.
 */
export const createOnlineMatch = async (
  hostPlayer: OnlineMatchPlayer,
  timeControl: TimeControl,
  colorPreference: 'white' | 'black' | 'random' | 'w' | 'b' = 'random',
  roomCode?: string,
  opponentPlayer?: OnlineMatchPlayer | null
): Promise<string> => {
  const cleanCode = normalizeRoomCode(roomCode) || `MATCH_${Date.now()}`;
  const gameId = cleanCode;
  const matchDocRef = doc(db, 'online_matches', gameId);

  // Fast check: if match doc already exists and is active or in_progress, return existing ID
  try {
    const existingSnap = await getDoc(matchDocRef);
    if (existingSnap.exists()) {
      const existing = existingSnap.data() as OnlineMatchSession;
      if (
        (existing.status === 'active' || existing.status === 'in_progress' || existing.status === 'ready' || existing.status === 'waiting') &&
        existing.fen &&
        existing.fen.trim() !== ''
      ) {
        // Cache locally for fast retrieval
        try {
          localStorage.setItem(`chess_match_${gameId}`, JSON.stringify(existing));
          localStorage.setItem(`online_match_${gameId}`, JSON.stringify(existing));
        } catch {}
        return gameId;
      }
    }
  } catch (err) {
    console.warn('[MatchService] Non-blocking existing check notice:', err);
  }

  // Strict Color Assignment based on room.settings.color
  let isHostWhite = true;
  if (colorPreference === 'white' || colorPreference === 'w') {
    isHostWhite = true;
  } else if (colorPreference === 'black' || colorPreference === 'b') {
    isHostWhite = false;
  } else {
    // Random side selection
    isHostWhite = Math.random() < 0.5;
  }

  const whitePlayer = isHostWhite ? hostPlayer : (opponentPlayer || null);
  const blackPlayer = isHostWhite ? (opponentPlayer || null) : hostPlayer;

  const whiteId = isHostWhite
    ? hostPlayer.uid
    : (opponentPlayer?.uid || 'guest_white');
  const blackId = isHostWhite
    ? (opponentPlayer?.uid || 'guest_black')
    : hostPlayer.uid;

  const initialSeconds = Number(timeControl?.initialSeconds) || 600;
  const incrementSeconds = Number(timeControl?.incrementSeconds) || 0;

  const initialSession: OnlineMatchSession = {
    id: gameId,
    code: gameId,
    hostId: hostPlayer.uid,
    ...(opponentPlayer?.uid ? { guestId: opponentPlayer.uid } : {}),
    whiteId,
    blackId,
    whitePlayer: whitePlayer || null,
    blackPlayer: blackPlayer || null,
    fen: STARTING_FEN,
    startFen: STARTING_FEN,
    pgn: '',
    moves: [],
    turn: 'w',
    status: 'active',
    winner: null,
    timeControl: {
      id: timeControl?.id || 'rapid_10',
      name: timeControl?.name || '10 min',
      initialSeconds,
      incrementSeconds,
      category:
        timeControl?.category ||
        (initialSeconds < 180 ? 'bullet' : initialSeconds < 600 ? 'blitz' : 'rapid'),
    },
    clocks: {
      white: initialSeconds,
      black: initialSeconds,
      lastMoveTimestamp: Date.now(),
    },
    whiteSecondsRemaining: initialSeconds,
    blackSecondsRemaining: initialSeconds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Cache locally immediately to ensure instant availability
  try {
    localStorage.setItem(`chess_match_${gameId}`, JSON.stringify(initialSession));
    localStorage.setItem(`online_match_${gameId}`, JSON.stringify(initialSession));
  } catch {}

  // Write to Firestore with setDoc first, fall back to safeSetDoc
  try {
    await setDoc(matchDocRef, initialSession);
  } catch (err) {
    console.warn('[MatchService] Direct setDoc fallback to safeSetDoc notice:', err);
    await safeSetDoc(matchDocRef, initialSession);
  }

  return gameId;
};

/**
 * Handshake Verification Helper:
 * Strictly verifies that a given gameId exists in Firestore under the 'online_matches' collection
 * or verified in-session storage and possesses valid game state before navigation.
 */
export const verifyOnlineMatchExists = async (
  gameId: string | null | undefined
): Promise<boolean> => {
  if (!gameId || typeof gameId !== 'string' || gameId.trim() === '') {
    return false;
  }
  const cleanId = gameId.trim();
  const matchDocRef = doc(db, 'online_matches', cleanId);

  // Poll with retry to gracefully accommodate Firestore write latency
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const snap = await getDoc(matchDocRef);
      if (snap.exists()) {
        const data = snap.data();
        // Validate essential match properties
        const hasValidId = Boolean(data?.id || data?.code);
        const hasValidFen = Boolean(typeof data?.fen === 'string' && data.fen.trim().length > 0);
        const isPlayable = Boolean(
          data?.status === 'active' ||
          data?.status === 'in_progress' ||
          data?.status === 'waiting' ||
          data?.status === 'ready'
        );
        if (hasValidId && hasValidFen && isPlayable) {
          // Re-sync local cache
          try {
            localStorage.setItem(`chess_match_${cleanId}`, JSON.stringify(data));
          } catch {}
          return true;
        }
      }
    } catch (err) {
      console.warn(`[MatchService] Verification check attempt ${attempt + 1} notice for ${cleanId}:`, err);
    }

    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Fallback: verify local storage session cache if network or remote read timed out
  try {
    const localMatch = localStorage.getItem(`chess_match_${cleanId}`) || localStorage.getItem(`online_match_${cleanId}`);
    if (localMatch) {
      const parsed = JSON.parse(localMatch);
      if (parsed?.id && parsed?.fen && (parsed.status === 'active' || parsed.status === 'in_progress' || parsed.status === 'waiting' || parsed.status === 'ready')) {
        return true;
      }
    }
  } catch {}

  return false;
};

export default {
  createOnlineMatch,
  verifyOnlineMatchExists,
};
