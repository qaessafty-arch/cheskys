import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  query,
  where,
  limit,
  onSnapshot, 
  serverTimestamp, deleteField 
} from 'firebase/firestore';
import { 
  db, 
  handleFirestoreError, 
  OperationType, 
  isFirestoreQuotaExhaustedError,
  safeSetDoc,
  safeUpdateDoc,
  safeDeleteDoc,
  isFirestoreQuotaExhausted
} from '../utils/firebase';
import { OnlineMatchSession, OnlineMatchPlayer, TimeControl } from '../types/chess';
import { Chess } from 'chess.js';

export interface MatchmakingTicket {
  id: string;
  player: OnlineMatchPlayer;
  timeControl: TimeControl;
  status: 'waiting' | 'matched' | 'cancelled';
  matchId?: string;
  createdAt: number;
}

// Worldwide pool of Grandmaster challengers for instant matchmaking pairing
export const WORLDWIDE_CHALLENGERS: OnlineMatchPlayer[] = [
  {
    uid: 'ww_aryakrd_88',
    displayName: 'Peshmerga Arya ☀️',
    country: 'Kurdistan',
    flag: '☀️',
    elo: 1845,
    honorRank: 'Peshmerga Strategist',
    rankBadge: '🦅',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
  },
  {
    uid: 'ww_hikaru_usa',
    displayName: 'BlitzHawk_US 🇺🇸',
    country: 'United States',
    flag: '🇺🇸',
    elo: 2150,
    honorRank: 'Grandmaster Champion',
    rankBadge: '👑',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
  },
  {
    uid: 'ww_elena_esp',
    displayName: 'Elena_Tactics 🇪🇸',
    country: 'Spain',
    flag: '🇪🇸',
    elo: 1720,
    honorRank: 'Knight Commander',
    rankBadge: '⚔️',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80'
  },
  {
    uid: 'ww_magnus_nor',
    displayName: 'VikingEndgame 🇳🇴',
    country: 'Norway',
    flag: '🇳🇴',
    elo: 2320,
    honorRank: 'Sovereign Grandmaster',
    rankBadge: '👑',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
  },
  {
    uid: 'ww_yuki_jpn',
    displayName: 'Yuki_Shogi 🇯🇵',
    country: 'Japan',
    flag: '🇯🇵',
    elo: 1910,
    honorRank: 'High Tactician',
    rankBadge: '🌿',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80'
  },
  {
    uid: 'ww_kurdish_lion',
    displayName: 'Zagros_Lion ☀️',
    country: 'Kurdistan',
    flag: '☀️',
    elo: 1680,
    honorRank: 'Mountain Guardian',
    rankBadge: '🛡️',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80'
  },
  {
    uid: 'ww_gabriel_bra',
    displayName: 'SambaGambit 🇧🇷',
    country: 'Brazil',
    flag: '🇧🇷',
    elo: 1795,
    honorRank: 'Peshmerga Tactician',
    rankBadge: '🌿',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80'
  },
  {
    uid: 'ww_marcel_fra',
    displayName: 'Marcel_Paris 🇫🇷',
    country: 'France',
    flag: '🇫🇷',
    elo: 1980,
    honorRank: 'Royal Guard',
    rankBadge: '⚔️',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80'
  }
];

export type MatchmakingMode = 'human_first' | 'human_strict' | 'instant_bot';

export const joinWorldwideMatchmaking = async (
  player: OnlineMatchPlayer,
  timeControl: TimeControl,
  onMatched: (matchId: string, opponent: OnlineMatchPlayer, isBot: boolean) => void,
  onStatusUpdate?: (statusText: string) => void,
  matchmakingMode: MatchmakingMode = 'human_first',
  fallbackTimeoutSeconds: number = 20
): Promise<{ ticketId: string; cancel: () => void; pairWithBotNow: () => void }> => {
  let isCancelled = false;
  let hasMatched = false;
  const ticketId = `ticket_${player.uid}_${Date.now()}`;
  const ticketDocRef = doc(db, 'matchmaking_queue', ticketId);

  let unsubMyTicket: (() => void) | null = null;
  let unsubQueue: (() => void) | null = null;
  let fallbackTimer: NodeJS.Timeout | null = null;

  const triggerBotFallback = async (reason = 'No active human found — pairing with worldwide grandmaster bot...') => {
    if (isCancelled || hasMatched) return;
    hasMatched = true;

    if (unsubMyTicket) unsubMyTicket();
    if (unsubQueue) unsubQueue();
    if (fallbackTimer) clearTimeout(fallbackTimer);

    onStatusUpdate?.(reason);

    // Pick a random worldwide challenger
    const randomChallenger = WORLDWIDE_CHALLENGERS[Math.floor(Math.random() * WORLDWIDE_CHALLENGERS.length)];
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const matchDocRef = doc(db, 'online_matches', matchId);

    const isHostWhite = Math.random() < 0.5;
    const whitePlayer = isHostWhite ? player : randomChallenger;
    const blackPlayer = isHostWhite ? randomChallenger : player;

    const initialSession: OnlineMatchSession = {
      id: matchId,
      hostId: player.uid,
      guestId: randomChallenger.uid,
      whitePlayer,
      blackPlayer,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      turn: 'w',
      status: 'in_progress',
      winner: null,
      timeControl,
      whiteSecondsRemaining: timeControl.initialSeconds,
      blackSecondsRemaining: timeControl.initialSeconds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await safeSetDoc(matchDocRef, initialSession);
      await safeDeleteDoc(ticketDocRef);
    } catch (e: any) {
      console.warn('Error creating bot session:', e?.message);
    }

    onMatched(matchId, randomChallenger, true);
  };

  try {
    // If instant bot requested, execute immediately
    if (matchmakingMode === 'instant_bot') {
      onStatusUpdate?.('Initializing Grandmaster Bot duel...');
      setTimeout(() => {
        triggerBotFallback('Connecting to Grandmaster Bot...');
      }, 600);
      return {
        ticketId,
        cancel: () => {
          isCancelled = true;
        },
        pairWithBotNow: () => {}
      };
    }

    onStatusUpdate?.('Scanning worldwide live queue for real human players...');

    // Helper to pair with a found waiting human ticket
    const pairWithHumanTicket = async (otherTicketDoc: MatchmakingTicket, otherDocId: string) => {
      if (isCancelled || hasMatched) return;
      hasMatched = true;

      if (unsubMyTicket) unsubMyTicket();
      if (unsubQueue) unsubQueue();
      if (fallbackTimer) clearTimeout(fallbackTimer);

      onStatusUpdate?.(`Real human player matched: ${otherTicketDoc.player.displayName}! Initializing arena...`);

      const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const matchDocRef = doc(db, 'online_matches', matchId);

      const isHostWhite = Math.random() < 0.5;
      const whitePlayer = isHostWhite ? otherTicketDoc.player : player;
      const blackPlayer = isHostWhite ? player : otherTicketDoc.player;

      const initialSession: OnlineMatchSession = {
        id: matchId,
        hostId: otherTicketDoc.player.uid,
        guestId: player.uid,
        whitePlayer,
        blackPlayer,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        turn: 'w',
        status: 'in_progress',
        winner: null,
        timeControl,
        whiteSecondsRemaining: timeControl.initialSeconds,
        blackSecondsRemaining: timeControl.initialSeconds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 1. Create match session
      await safeSetDoc(matchDocRef, initialSession);

      // 2. Notify the other player's ticket
      await safeUpdateDoc(doc(db, 'matchmaking_queue', otherDocId), {
        status: 'matched',
        matchId
      });

      // 3. Clean up our own ticket
      await safeDeleteDoc(ticketDocRef);

      onMatched(matchId, otherTicketDoc.player, false);
    };

    // 1. Check existing waiting tickets from other humans
    const q = query(
      collection(db, 'matchmaking_queue'),
      where('status', '==', 'waiting'),
      limit(10)
    );

    const snapshot = await getDocs(q);
    let candidateTicket: { data: MatchmakingTicket; id: string } | null = null;

    snapshot.forEach(docSnap => {
      const data = docSnap.data() as MatchmakingTicket;
      if (
        data?.player?.uid !== player?.uid &&
        data?.status === 'waiting' &&
        Date.now() - (data?.createdAt || 0) < 180000 // fresh within 3 mins
      ) {
        candidateTicket = { data, id: docSnap.id };
      }
    });

    if (candidateTicket && !isCancelled) {
      // Immediate live human found!
      await pairWithHumanTicket(candidateTicket.data, candidateTicket.id);
      return {
        ticketId,
        cancel: () => {
          isCancelled = true;
        },
        pairWithBotNow: () => {}
      };
    }

    // 2. No waiting human currently; register our ticket in Firestore
    const ticketData: MatchmakingTicket = {
      id: ticketId,
      player,
      timeControl,
      status: 'waiting',
      createdAt: Date.now()
    };

    await safeSetDoc(ticketDocRef, ticketData);
    onStatusUpdate?.('Waiting for real human challengers to join worldwide queue...');

    // 3. Listen to our own ticket doc to see if someone pairs with us
    unsubMyTicket = onSnapshot(ticketDocRef, snap => {
      if (isCancelled || hasMatched) return;
      if (snap.exists()) {
        const data = snap.data() as MatchmakingTicket;
        if (data.status === 'matched' && data.matchId) {
          hasMatched = true;
          if (unsubMyTicket) unsubMyTicket();
          if (unsubQueue) unsubQueue();
          if (fallbackTimer) clearTimeout(fallbackTimer);

          onStatusUpdate?.('Match confirmed with real human! Entering arena...');
          onMatched(data.matchId, data.player, false);
        }
      }
    }, err => {
      console.warn('Matchmaking ticket stream:', err.message);
    });

    // 4. Also listen in real-time to the queue collection for incoming new players
    unsubQueue = onSnapshot(q, snap => {
      if (isCancelled || hasMatched) return;
      snap.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const docData = change.doc.data() as MatchmakingTicket;
          if (
            change.doc.id !== ticketId &&
            docData?.player?.uid !== player?.uid &&
            docData?.status === 'waiting' &&
            Date.now() - (docData?.createdAt || 0) < 180000
          ) {
            pairWithHumanTicket(docData, change.doc.id);
          }
        }
      });
    }, err => {
      console.warn('Matchmaking queue stream:', err.message);
    });

    // 5. If Human-First mode, start fallback timer
    if (matchmakingMode === 'human_first') {
      fallbackTimer = setTimeout(() => {
        if (!isCancelled && !hasMatched) {
          triggerBotFallback('No human joined in 20s. Pairing with Worldwide Grandmaster...');
        }
      }, fallbackTimeoutSeconds * 1000);
    }

    const cancel = async () => {
      isCancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (unsubMyTicket) unsubMyTicket();
      if (unsubQueue) unsubQueue();
      await safeDeleteDoc(ticketDocRef);
    };

    const pairWithBotNow = () => {
      if (!isCancelled && !hasMatched) {
        triggerBotFallback('Connecting immediately with Grandmaster Bot...');
      }
    };

    return { ticketId, cancel, pairWithBotNow };
  } catch (e) {
    console.error('Error in worldwide matchmaking:', e);
    const randomChallenger = WORLDWIDE_CHALLENGERS[0];
    const matchId = `match_${Date.now()}_local`;
    onMatched(matchId, randomChallenger, true);
    return {
      ticketId,
      cancel: () => {
        isCancelled = true;
      },
      pairWithBotNow: () => {}
    };
  }
};

export const createOnlineMatchChallenge = async (
  hostPlayer: OnlineMatchPlayer,
  guestPlayer: OnlineMatchPlayer,
  timeControl: TimeControl,
  hostColorChoice: 'w' | 'b' | 'random' = 'random'
): Promise<string | null> => {
  const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const matchDocRef = doc(db, 'online_matches', matchId);

    // Determine colors
    let isHostWhite = true;
    if (hostColorChoice === 'w') {
      isHostWhite = true;
    } else if (hostColorChoice === 'b') {
      isHostWhite = false;
    } else {
      isHostWhite = Math.random() < 0.5;
    }

    const whitePlayer = isHostWhite ? hostPlayer : guestPlayer;
    const blackPlayer = isHostWhite ? guestPlayer : hostPlayer;

    const initialSession: OnlineMatchSession = {
      id: matchId,
      hostId: hostPlayer.uid,
      guestId: guestPlayer.uid,
      whitePlayer,
      blackPlayer,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      moves: [],
      turn: 'w',
      status: 'waiting',
      winner: null,
      timeControl,
      whiteSecondsRemaining: timeControl.initialSeconds,
      blackSecondsRemaining: timeControl.initialSeconds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await safeSetDoc(matchDocRef, initialSession);

    // Record locally for immediate retrieval in My Rooms
    recordLocalUserCreatedRoom({
      code: matchId,
      hostId: hostPlayer.uid,
      timeControl,
      side: isHostWhite ? 'w' : 'b',
      status: 'waiting',
      createdAt: initialSession.createdAt
    });

    return matchId;
  } catch (e: any) {
    console.warn('Error creating online match challenge:', e?.message);
    return matchId;
  }
};

export const acceptOnlineMatchChallenge = async (matchId: string): Promise<boolean> => {
  const matchDocRef = doc(db, 'online_matches', matchId);
  await safeUpdateDoc(matchDocRef, {
    status: 'in_progress',
    updatedAt: new Date().toISOString()
  });
  return true;
};

export const sendOnlineMove = async (
  matchId: string,
  newFen: string,
  newPgn: string,
  nextTurn: 'w' | 'b',
  from: string,
  to: string,
  whiteSeconds: number,
  blackSeconds: number,
  status: 'in_progress' | 'checkmate' | 'draw' = 'in_progress',
  winner: 'w' | 'b' | 'draw' | null = null,
  reason?: string
): Promise<boolean> => {
  const matchDocRef = doc(db, 'online_matches', matchId);
  await safeUpdateDoc(matchDocRef, {
    fen: newFen,
    pgn: newPgn,
    turn: nextTurn,
    lastMoveFrom: from,
    lastMoveTo: to,
    lastMoveTimestamp: Date.now(),
    whiteSecondsRemaining: whiteSeconds,
    blackSecondsRemaining: blackSeconds,
    status,
    winner,
    reason: reason || null,
    drawOfferFrom: null,
    updatedAt: new Date().toISOString()
  });
  return true;
};

export const resignOnlineMatch = async (
  matchId: string,
  resigningColor: 'w' | 'b',
  resigningPlayerName: string
): Promise<boolean> => {
  const matchDocRef = doc(db, 'online_matches', matchId);
  const winner = resigningColor === 'w' ? 'b' : 'w';
  await safeUpdateDoc(matchDocRef, {
    status: 'resigned',
    winner,
    reason: `${resigningPlayerName} resigned the match.`,
    updatedAt: new Date().toISOString()
  });
  return true;
};

export const offerDrawOnlineMatch = async (
  matchId: string,
  offeringPlayerId: string
): Promise<boolean> => {
  const matchDocRef = doc(db, 'online_matches', matchId);
  await safeUpdateDoc(matchDocRef, {
    drawOfferFrom: offeringPlayerId,
    updatedAt: new Date().toISOString()
  });
  return true;
};

export const acceptDrawOnlineMatch = async (matchId: string): Promise<boolean> => {
  const matchDocRef = doc(db, 'online_matches', matchId);
  await safeUpdateDoc(matchDocRef, {
    status: 'draw',
    winner: 'draw',
    reason: 'Game drawn by mutual agreement of both grandmasters.',
    drawOfferFrom: null,
    updatedAt: new Date().toISOString()
  });
  return true;
};

export const finalizeOnlineMatch = async (matchId: string, winner: 'w' | 'b' | 'draw', reason: string) => {
  try {
    const matchRef = doc(db, 'online_matches', matchId);
    const snap = await getDoc(matchRef);
    if (!snap.exists()) return;
    const data = snap.data();

    await safeUpdateDoc(matchRef, {
      status: winner === 'draw' ? 'draw' : 'completed',
      winner,
      reason,
      updatedAt: new Date().toISOString()
    });

    // Automatically advance tournament bracket if this was a tournament match
    if (data.tournamentId && data.tournamentMatchId && winner !== 'draw') {
      const winnerUid = winner === 'w' ? data.whitePlayer.uid : data.blackPlayer.uid;
      const { advanceTournamentMatch } = await import('./tournamentService');
      await advanceTournamentMatch(data.tournamentId, data.tournamentMatchId, winnerUid);
    }
  } catch (e: any) {
    console.warn('finalizeOnlineMatch notice:', e?.message);
  }
};

export const listenToOnlineMatchSession = (
  matchId: string,
  callback: (session: OnlineMatchSession | null) => void
) => {
  if (!matchId) return () => {};

  try {
    const docRef = doc(db, 'online_matches', matchId);
    const unsub = onSnapshot(docRef, snap => {
      if (snap.exists()) {
        callback(snap.data() as OnlineMatchSession);
      } else {
        callback(null);
      }
    }, err => {
      console.warn('Online match session listener error:', err);
    });

    return unsub;
  } catch (e) {
    console.error('Failed to listen to online match session:', e);
    return () => {};
  }
};

/**
 * Generates a memorable, unique 6-character game room code
 * (Uppercase alphanumeric, excluding ambiguous characters 0, O, 1, I)
 */
export const generateGameRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Creates an open multiplayer match room in Firestore with a 6-character code
 */
export const createOnlineMatch = async (
  hostPlayer: OnlineMatchPlayer,
  timeControl: TimeControl,
  side: 'w' | 'b' | 'random' = 'random',
  customCode?: string
): Promise<string> => {
  const cleanCode = (customCode?.trim().toUpperCase() || generateGameRoomCode());
  const matchId = cleanCode;
  const matchDocRef = doc(db, 'online_matches', matchId);

  // If match already exists and is in_progress, don't overwrite it
  try {
    const checkPromise = getDoc(matchDocRef);
    const timeoutPromise = new Promise<'timeout'>((res) => setTimeout(() => res('timeout'), 1500));
    const raceResult = await Promise.race([checkPromise, timeoutPromise]);
    if (raceResult !== 'timeout' && raceResult.exists()) {
      const existing = raceResult.data() as OnlineMatchSession;
      if (existing.status === 'in_progress') {
        return matchId;
      }
    }
  } catch (e) {
    // ignore read error
  }

  const resolvedSide = side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
  const isHostWhite = resolvedSide === 'w';

  const initialSession: OnlineMatchSession = {
    id: matchId,
    code: matchId,
    hostId: hostPlayer.uid,
    whitePlayer: isHostWhite ? hostPlayer : null,
    blackPlayer: isHostWhite ? null : hostPlayer,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '',
    moves: [],
    turn: 'w',
    status: 'waiting',
    winner: null,
    timeControl,
    whiteSecondsRemaining: timeControl.initialSeconds,
    blackSecondsRemaining: timeControl.initialSeconds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await safeSetDoc(matchDocRef, initialSession);

  // Record locally for instantaneous retrieval in My Rooms
  recordLocalUserCreatedRoom({
    code: matchId,
    hostId: hostPlayer.uid,
    timeControl,
    side: resolvedSide,
    status: 'waiting',
    createdAt: initialSession.createdAt
  });

  // Also register with server REST endpoint in background
  try {
    fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customCode: matchId,
        timeControl,
        side,
        playerInfo: hostPlayer
      })
    }).catch(() => {});
  } catch {}

  return matchId;
};

/**
 * Joins an existing multiplayer match room as the challenger/guest
 */
export const joinOnlineMatch = async (
  codeOrId: string,
  guestPlayer: OnlineMatchPlayer
): Promise<OnlineMatchSession> => {
  const cleanCode = codeOrId.trim().toUpperCase();
  let matchDocRef = doc(db, 'online_matches', cleanCode);
  let snap = await getDoc(matchDocRef);

  // If not found by direct ID, search by code field or lowercase ID
  if (!snap.exists()) {
    const q = query(
      collection(db, 'online_matches'),
      where('code', '==', cleanCode),
      limit(1)
    );
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      matchDocRef = querySnap.docs[0].ref;
      snap = querySnap.docs[0];
    } else {
      // Fallback: search by id case-insensitively if legacy match_ id
      const legacyRef = doc(db, 'online_matches', codeOrId.trim());
      snap = await getDoc(legacyRef);
      if (snap.exists()) {
        matchDocRef = legacyRef;
      }
    }
  }

  // If still not found in online_matches, search the rooms collection (Private Rooms)
  if (!snap.exists()) {
    const roomDocRef = doc(db, 'rooms', cleanCode);
    const roomSnap = await getDoc(roomDocRef);
    if (roomSnap.exists()) {
      const roomData = roomSnap.data() as any;
      if (roomData.status !== 'waiting' && roomData.opponentId && roomData.opponentId !== guestPlayer.uid) {
        throw new Error('Match room is already full or in progress.');
      }

      const hostPlayer: OnlineMatchPlayer = {
        uid: roomData.creatorId,
        displayName: roomData.creatorName || 'Host',
        avatar: roomData.creatorPhotoURL || null,
        elo: Number(roomData.creatorElo) || 1200,
      };

      const preferredSide = roomData.settings?.color || roomData.creatorColor || 'random';
      const isHostWhite = preferredSide === 'white' ? true : preferredSide === 'black' ? false : Math.random() < 0.5;

      const tc: TimeControl = {
        id: roomData.settings?.timeControlId || 'rapid',
        name: roomData.settings?.timeControlName || 'Rapid 10+0',
        initialSeconds: Number(roomData.settings?.initialSeconds) || 600,
        incrementSeconds: Number(roomData.settings?.incrementSeconds) || 0,
        category: (Number(roomData.settings?.initialSeconds) || 600) < 180 ? 'bullet' : (Number(roomData.settings?.initialSeconds) || 600) < 600 ? 'blitz' : 'rapid',
      };

      const whitePlayer = isHostWhite ? hostPlayer : guestPlayer;
      const blackPlayer = isHostWhite ? guestPlayer : hostPlayer;

      const newSession: OnlineMatchSession = {
        id: cleanCode,
        code: cleanCode,
        hostId: roomData.creatorId,
        guestId: guestPlayer.uid,
        whitePlayer,
        blackPlayer,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        moves: [],
        turn: 'w',
        status: 'in_progress',
        winner: null,
        timeControl: tc,
        whiteSecondsRemaining: tc.initialSeconds,
        blackSecondsRemaining: tc.initialSeconds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Create the live match in online_matches
      await safeSetDoc(matchDocRef, newSession);

      // Also update the private room to let the host know someone joined
      await safeUpdateDoc(roomDocRef, {
        opponentId: guestPlayer.uid,
        opponentName: guestPlayer.displayName || 'Challenger',
        opponentPhotoURL: guestPlayer.avatar || guestPlayer.photoURL || null,
        opponentElo: guestPlayer.elo || 1200,
        status: 'in_progress',
        gameId: cleanCode,
        updatedAt: serverTimestamp(),
      });

      // Also notify server REST endpoint
      try {
        fetch(`/api/games/${encodeURIComponent(cleanCode)}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerInfo: guestPlayer })
        }).catch(() => {});
      } catch {}

      return newSession;
    }

    // Also check query on rooms where roomCode == cleanCode
    const roomQuery = query(
      collection(db, 'rooms'),
      where('roomCode', '==', cleanCode),
      limit(1)
    );
    const roomQuerySnap = await getDocs(roomQuery);
    if (!roomQuerySnap.empty) {
      const roomDoc = roomQuerySnap.docs[0];
      const roomData = roomDoc.data() as any;
      if (roomData.status !== 'waiting' && roomData.opponentId && roomData.opponentId !== guestPlayer.uid) {
        throw new Error('Match room is already full or in progress.');
      }

      const hostPlayer: OnlineMatchPlayer = {
        uid: roomData.creatorId,
        displayName: roomData.creatorName || 'Host',
        avatar: roomData.creatorPhotoURL || null,
        elo: Number(roomData.creatorElo) || 1200,
      };

      const preferredSide = roomData.settings?.color || roomData.creatorColor || 'random';
      const isHostWhite = preferredSide === 'white' ? true : preferredSide === 'black' ? false : Math.random() < 0.5;

      const tc: TimeControl = {
        id: roomData.settings?.timeControlId || 'rapid',
        name: roomData.settings?.timeControlName || 'Rapid 10+0',
        initialSeconds: Number(roomData.settings?.initialSeconds) || 600,
        incrementSeconds: Number(roomData.settings?.incrementSeconds) || 0,
        category: (Number(roomData.settings?.initialSeconds) || 600) < 180 ? 'bullet' : (Number(roomData.settings?.initialSeconds) || 600) < 600 ? 'blitz' : 'rapid',
      };

      const whitePlayer = isHostWhite ? hostPlayer : guestPlayer;
      const blackPlayer = isHostWhite ? guestPlayer : hostPlayer;

      const newSession: OnlineMatchSession = {
        id: cleanCode,
        code: cleanCode,
        hostId: roomData.creatorId,
        guestId: guestPlayer.uid,
        whitePlayer,
        blackPlayer,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        moves: [],
        turn: 'w',
        status: 'in_progress',
        winner: null,
        timeControl: tc,
        whiteSecondsRemaining: tc.initialSeconds,
        blackSecondsRemaining: tc.initialSeconds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await safeSetDoc(matchDocRef, newSession);

      await safeUpdateDoc(roomDoc.ref, {
        opponentId: guestPlayer.uid,
        opponentName: guestPlayer.displayName || 'Challenger',
        opponentPhotoURL: guestPlayer.avatar || guestPlayer.photoURL || null,
        opponentElo: guestPlayer.elo || 1200,
        status: 'in_progress',
        gameId: cleanCode,
        updatedAt: serverTimestamp(),
      });

      return newSession;
    }

    // Check if room exists in server in-memory matchmaking API
    try {
      const serverRes = await fetch(`/api/games/${encodeURIComponent(cleanCode)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerInfo: guestPlayer })
      });
      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data && data.success) {
          const tc: TimeControl = {
            id: 'rapid',
            name: 'Rapid 10+0',
            initialSeconds: 600,
            incrementSeconds: 0,
            category: 'rapid'
          };
          const serverSession: OnlineMatchSession = {
            id: data.gameId || cleanCode,
            code: data.gameCode || cleanCode,
            hostId: 'host_server',
            guestId: guestPlayer.uid,
            whitePlayer: data.playerColor === 'white' ? guestPlayer : { uid: 'host_server', displayName: 'Host', elo: 1200 },
            blackPlayer: data.playerColor === 'black' ? guestPlayer : { uid: 'host_server', displayName: 'Host', elo: 1200 },
            fen: data.game?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            pgn: data.game?.pgn || '',
            moves: data.game?.moves || [],
            turn: 'w',
            status: 'in_progress',
            winner: null,
            timeControl: tc,
            whiteSecondsRemaining: tc.initialSeconds,
            blackSecondsRemaining: tc.initialSeconds,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await safeSetDoc(doc(db, 'online_matches', cleanCode), serverSession);
          return serverSession;
        }
      }
    } catch {
      // Ignore server fallback error and throw user-friendly error below
    }

    throw new Error(`Match room "${cleanCode}" not found. Please verify the code.`);
  }

  const session = snap.data() as OnlineMatchSession;
  if (session.status !== 'waiting' && session.guestId && session.guestId !== guestPlayer.uid) {
    throw new Error('Match room is already full or in progress.');
  }

  const whitePlayer = session.whitePlayer || guestPlayer;
  const blackPlayer = session.blackPlayer || guestPlayer;

  const updateData: Partial<OnlineMatchSession> = {
    guestId: guestPlayer.uid,
    whitePlayer,
    blackPlayer,
    status: 'in_progress',
    updatedAt: new Date().toISOString()
  };

  await safeUpdateDoc(matchDocRef, updateData);

  // If this match is also in rooms, update the room as well
  try {
    const rRef = doc(db, 'rooms', cleanCode);
    const rSnap = await getDoc(rRef);
    if (rSnap.exists()) {
      await safeUpdateDoc(rRef, {
        opponentId: guestPlayer.uid,
        opponentName: guestPlayer.displayName || 'Challenger',
        opponentPhotoURL: guestPlayer.avatar || guestPlayer.photoURL || null,
        opponentElo: guestPlayer.elo || 1200,
        status: 'in_progress',
        gameId: cleanCode,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    // Non-fatal
  }

  // Also notify server REST endpoint
  try {
    fetch(`/api/games/${encodeURIComponent(cleanCode)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerInfo: guestPlayer })
    }).catch(() => {});
  } catch {}

  return { ...session, ...updateData } as OnlineMatchSession;
};

/**
 * Listens to active open challenges waiting for a player
 */
export const listenToPublicOpenMatches = (
  callback: (matches: OnlineMatchSession[]) => void
) => {
  try {
    const q = query(
      collection(db, 'online_matches'),
      where('status', '==', 'waiting'),
      limit(20)
    );

    const unsub = onSnapshot(q, snap => {
      const matches: OnlineMatchSession[] = [];
      snap.forEach(docSnap => {
        matches.push(docSnap.data() as OnlineMatchSession);
      });
      callback(matches);
    }, err => {
      console.warn('Open matches listener error:', err);
      callback([]);
    });

    return unsub;
  } catch (e) {
    console.error('Failed to listen to open matches:', e);
    return () => {};
  }
};

export interface UserCreatedRoomItem {
  id: string;
  code: string;
  timeControl: TimeControl;
  status: string;
  createdAt: string;
  opponent?: {
    uid?: string;
    displayName?: string;
    avatar?: string;
    elo?: number;
  } | null;
  side?: 'w' | 'b' | 'random';
  isHost: boolean;
}

const LOCAL_CREATED_ROOMS_KEY = 'chessky_my_created_rooms';

export const recordLocalUserCreatedRoom = (room: {
  code: string;
  hostId: string;
  timeControl: TimeControl;
  side?: 'w' | 'b' | 'random';
  status?: string;
  createdAt?: string;
}) => {
  try {
    const raw = localStorage.getItem(LOCAL_CREATED_ROOMS_KEY);
    const existing: any[] = raw ? JSON.parse(raw) : [];
    const cleanCode = room.code.trim().toUpperCase();
    const filtered = existing.filter((r: any) => r.code !== cleanCode);
    filtered.unshift({
      id: cleanCode,
      code: cleanCode,
      hostId: room.hostId,
      timeControl: room.timeControl,
      side: room.side || 'random',
      status: room.status || 'waiting',
      createdAt: room.createdAt || new Date().toISOString(),
      isHost: true
    });
    localStorage.setItem(LOCAL_CREATED_ROOMS_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch (e) {
    // ignore storage limits
  }
};

export const getLocalUserCreatedRooms = (userUid?: string): UserCreatedRoomItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_CREATED_ROOMS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((item: any) => !userUid || item.hostId === userUid)
      .map((item: any) => ({
        id: item.code || item.id,
        code: (item.code || item.id).toUpperCase(),
        timeControl: item.timeControl || {
          id: 'rapid',
          name: 'Rapid 10m',
          initialSeconds: 600,
          incrementSeconds: 0,
          category: 'rapid'
        },
        status: item.status || 'waiting',
        createdAt: item.createdAt || new Date().toISOString(),
        side: item.side || 'random',
        isHost: true,
        opponent: item.opponent || null
      }));
  } catch {
    return [];
  }
};

/**
 * Listens to all rooms created by the specified user across online_matches,
 * rooms collections, and local storage fallback.
 */
export const listenToUserCreatedRooms = (
  userUid: string,
  callback: (rooms: UserCreatedRoomItem[]) => void
): (() => void) => {
  if (!userUid) {
    callback([]);
    return () => {};
  }

  let firestoreMatchRooms: Record<string, UserCreatedRoomItem> = {};
  let firestorePrivateRooms: Record<string, UserCreatedRoomItem> = {};

  const emitMerged = () => {
    const map = new Map<string, UserCreatedRoomItem>();

    // 1. Local baseline (fetch fresh to prevent stale overwrites during optimistic updates)
    const freshLocalBaseline = getLocalUserCreatedRooms(userUid);
    for (const r of freshLocalBaseline) {
      map.set(r.code, r);
    }

    // 2. Private rooms from /rooms collection
    for (const [code, r] of Object.entries(firestorePrivateRooms)) {
      map.set(code, r);
    }

    // 3. Online match sessions (highest priority)
    for (const [code, r] of Object.entries(firestoreMatchRooms)) {
      map.set(code, r);
    }

    const merged = Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    callback(merged);
  };

  // Immediate initial emission
  emitMerged();

  // Listen to /online_matches where hostId == userUid
  let unsubMatches = () => {};
  try {
    const qMatches = query(
      collection(db, 'online_matches'),
      where('hostId', '==', userUid),
      limit(50)
    );
    unsubMatches = onSnapshot(
      qMatches,
      snap => {
        firestoreMatchRooms = {};
        snap.forEach(docSnap => {
          const data = docSnap.data() as OnlineMatchSession;
          const code = (data.code || data.id || docSnap.id).toUpperCase();
          const isHostWhite = data.whitePlayer?.uid === userUid;
          const opponent = isHostWhite ? data.blackPlayer : data.whitePlayer;

          firestoreMatchRooms[code] = {
            id: data.id || docSnap.id,
            code,
            timeControl: data.timeControl || {
              id: 'rapid',
              name: 'Rapid 10m',
              initialSeconds: 600,
              incrementSeconds: 0,
              category: 'rapid'
            },
            status: data.status || 'waiting',
            createdAt: data.createdAt || new Date().toISOString(),
            opponent: opponent ? {
              uid: opponent.uid,
              displayName: opponent.displayName,
              avatar: opponent.avatar || opponent.photoURL,
              elo: opponent.elo
            } : null,
            side: isHostWhite ? 'w' : 'b',
            isHost: true
          };
        });
        emitMerged();
      },
      err => {
        console.warn('User matches stream notice:', err?.message);
      }
    );
  } catch (e) {
    console.warn('Could not subscribe to online_matches by hostId:', e);
  }

  // Listen to /rooms where creatorId == userUid
  let unsubRooms = () => {};
  try {
    const qRooms = query(
      collection(db, 'rooms'),
      where('creatorId', '==', userUid),
      limit(50)
    );
    unsubRooms = onSnapshot(
      qRooms,
      snap => {
        firestorePrivateRooms = {};
        snap.forEach(docSnap => {
          const data = docSnap.data() as any;
          const code = (data.roomCode || docSnap.id).toUpperCase();
          const tc: TimeControl = {
            id: data.settings?.timeControlId || 'rapid',
            name: data.settings?.timeControlName || 'Rapid 10m',
            initialSeconds: Number(data.settings?.initialSeconds) || 600,
            incrementSeconds: Number(data.settings?.incrementSeconds) || 0,
            category: (Number(data.settings?.initialSeconds) || 600) < 180 ? 'bullet' : (Number(data.settings?.initialSeconds) || 600) < 600 ? 'blitz' : 'rapid'
          };

          firestorePrivateRooms[code] = {
            id: docSnap.id,
            code,
            timeControl: tc,
            status: data.status || 'waiting',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            opponent: data.opponentId ? {
              uid: data.opponentId,
              displayName: data.opponentName || 'Challenger',
              avatar: data.opponentPhotoURL,
              elo: data.opponentElo
            } : null,
            side: data.creatorColor === 'white' ? 'w' : data.creatorColor === 'black' ? 'b' : 'random',
            isHost: true
          };
        });
        emitMerged();
      },
      err => {
        console.warn('User private rooms stream notice:', err?.message);
      }
    );
  } catch (e) {
    console.warn('Could not subscribe to rooms by creatorId:', e);
  }

  return () => {
    unsubMatches();
    unsubRooms();
  };
};

/**
 * Cancels a waiting room created by the current user
 */
export const cancelUserCreatedRoom = async (roomCode: string, userUid: string): Promise<void> => {
  const cleanCode = roomCode.trim().toUpperCase();

  // 1. Update local storage
  try {
    const raw = localStorage.getItem(LOCAL_CREATED_ROOMS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const updated = list.map((item: any) => {
          if (item.code === cleanCode) {
            return { ...item, status: 'aborted' };
          }
          return item;
        });
        localStorage.setItem(LOCAL_CREATED_ROOMS_KEY, JSON.stringify(updated));
      }
    }
  } catch {}

  // 2. Update online_matches
  try {
    const mRef = doc(db, 'online_matches', cleanCode);
    const mSnap = await getDoc(mRef);
    if (mSnap.exists()) {
      const data = mSnap.data();
      if (data.hostId === userUid || data.status === 'waiting') {
        await safeUpdateDoc(mRef, {
          status: 'aborted',
          reason: 'Cancelled by host',
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (e) {
    console.warn('Error updating match on cancel:', e);
  }

  // 3. Update rooms
  try {
    const rRef = doc(db, 'rooms', cleanCode);
    const rSnap = await getDoc(rRef);
    if (rSnap.exists()) {
      const data = rSnap.data();
      if (data.creatorId === userUid && data.status === 'waiting') {
        await safeDeleteDoc(rRef);
      }
    }
  } catch (e) {
    console.warn('Error deleting room on cancel:', e);
  }
};



export const offerRematchOnlineMatch = async (matchId: string, playerUid: string): Promise<void> => {
  const matchDocRef = doc(db, 'online_matches', matchId);
  await safeUpdateDoc(matchDocRef, {
    rematchOfferFrom: playerUid,
    updatedAt: new Date().toISOString()
  });
};

export const acceptRematchOnlineMatch = async (matchId: string, session: OnlineMatchSession): Promise<void> => {
  const matchDocRef = doc(db, 'online_matches', matchId);
  
  const currentWhite = session.whitePlayer;
  const currentBlack = session.blackPlayer;
  
  await safeUpdateDoc(matchDocRef, {
    rematchOfferFrom: deleteField(),
    whitePlayer: currentBlack,
    blackPlayer: currentWhite,
    fen: session.startFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '',
    moves: [],
    ucis: [],
    moveCount: 0,
    turn: 'w',
    status: 'in_progress',
    winner: null,
    reason: deleteField(),
    whiteSecondsRemaining: session.timeControl.initialSeconds,
    blackSecondsRemaining: session.timeControl.initialSeconds,
    updatedAt: new Date().toISOString()
  });
};
