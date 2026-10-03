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
import { logCompletedGame } from './loggingService';
import { getOnlineMatchSessionLocal } from './matchService';

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
  matchmakingMode: MatchmakingMode = 'human_strict',
  fallbackTimeoutSeconds: number = 20
): Promise<{ ticketId: string; cancel: () => void; pairWithBotNow: () => void }> => {
  let isCancelled = false;
  let hasMatched = false;
  const ticketId = `ticket_${player.uid}_${Date.now()}`;
  const ticketDocRef = doc(db, 'matchmaking_queue', ticketId);

  let unsubMyTicket: (() => void) | null = null;
  let unsubQueue: (() => void) | null = null;
  let fallbackTimer: NodeJS.Timeout | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const isTicketActive = (d: any): boolean => {
    if (!d) return false;
    const lastActive = d.lastPing || d.createdAt || 0;
    return Date.now() - lastActive < 45000; // active within last 45 seconds
  };

  const triggerBotFallback = async (reason = 'No active human found — pairing with worldwide grandmaster bot...') => {
    // If strict real human mode, strictly forbid bots
    if (matchmakingMode === 'human_strict') return;

    if (isCancelled || hasMatched) return;
    hasMatched = true;

    if (heartbeatTimer) clearInterval(heartbeatTimer);
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
    // If instant bot requested explicitly, execute
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

    onStatusUpdate?.('Scanning worldwide live queue for real live players...');

    // Helper to pair with a found waiting human ticket
    const pairWithHumanTicket = async (otherTicketDoc: MatchmakingTicket, otherDocId: string) => {
      if (isCancelled || hasMatched) return;
      hasMatched = true;

      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (unsubMyTicket) unsubMyTicket();
      if (unsubQueue) unsubQueue();
      if (fallbackTimer) clearTimeout(fallbackTimer);

      onStatusUpdate?.(`Real live player matched: ${otherTicketDoc.player.displayName}! Entering arena...`);

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

      // 2. Notify the other player's ticket with our real player info
      await safeUpdateDoc(doc(db, 'matchmaking_queue', otherDocId), {
        status: 'matched',
        matchId,
        matchedOpponent: player
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
        isTicketActive(data)
      ) {
        // Prioritize exact same time control if available
        if (!candidateTicket || data?.timeControl?.id === timeControl.id) {
          candidateTicket = { data, id: docSnap.id };
        }
      }
    });

    if (candidateTicket && !isCancelled) {
      // Immediate live human found!
      await pairWithHumanTicket((candidateTicket as any).data, (candidateTicket as any).id);
      return {
        ticketId,
        cancel: () => {
          isCancelled = true;
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        },
        pairWithBotNow: () => {}
      };
    }

    // 2. No waiting human currently; register our ticket in Firestore with active ping
    const nowTime = Date.now();
    const ticketData: MatchmakingTicket & { lastPing: number } = {
      id: ticketId,
      player,
      timeControl,
      status: 'waiting',
      createdAt: nowTime,
      lastPing: nowTime
    };

    await safeSetDoc(ticketDocRef, ticketData);
    onStatusUpdate?.('Searching worldwide live queue for real live players…');

    // Start 10-second heartbeat ping so others know this ticket is live
    heartbeatTimer = setInterval(async () => {
      if (isCancelled || hasMatched) {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        return;
      }
      try {
        await safeUpdateDoc(ticketDocRef, { lastPing: Date.now() });
      } catch {}
    }, 10000);

    // 3. Listen to our own ticket doc to see if another real player pairs with us
    unsubMyTicket = onSnapshot(ticketDocRef, snap => {
      if (isCancelled || hasMatched) return;
      if (snap.exists()) {
        const data = snap.data() as MatchmakingTicket & { matchedOpponent?: OnlineMatchPlayer };
        if (data.status === 'matched' && data.matchId) {
          hasMatched = true;
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          if (unsubMyTicket) unsubMyTicket();
          if (unsubQueue) unsubQueue();
          if (fallbackTimer) clearTimeout(fallbackTimer);

          const realOpponent = data.matchedOpponent || {
            uid: `human_${Date.now()}`,
            displayName: 'Real Live Challenger',
            country: 'Worldwide',
            flag: '🌍',
            elo: 1200
          };

          onStatusUpdate?.(`Real live player matched: ${realOpponent.displayName}! Entering arena...`);
          onMatched(data.matchId, realOpponent, false);
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
            isTicketActive(docData)
          ) {
            pairWithHumanTicket(docData, change.doc.id);
          }
        }
      });
    }, err => {
      console.warn('Matchmaking queue stream:', err.message);
    });

    // 5. If Human-First mode (non-strict only), start fallback timer
    if (matchmakingMode === 'human_first') {
      fallbackTimer = setTimeout(() => {
        if (!isCancelled && !hasMatched) {
          triggerBotFallback('No human joined in 20s. Pairing with Worldwide Grandmaster...');
        }
      }, fallbackTimeoutSeconds * 1000);
    }

    const cancel = async () => {
      isCancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (unsubMyTicket) unsubMyTicket();
      if (unsubQueue) unsubQueue();
      await safeDeleteDoc(ticketDocRef);
    };

    const pairWithBotNow = () => {
      if (matchmakingMode === 'human_strict') return; // Strict mode prohibits bots
      if (!isCancelled && !hasMatched) {
        triggerBotFallback('Connecting immediately with Grandmaster Bot...');
      }
    };

    return { ticketId, cancel, pairWithBotNow };
  } catch (e) {
    console.error('Error in worldwide matchmaking:', e);
    if (matchmakingMode === 'human_strict') {
      onStatusUpdate?.('Waiting in worldwide live real player queue...');
      return {
        ticketId,
        cancel: () => { isCancelled = true; if (heartbeatTimer) clearInterval(heartbeatTimer); },
        pairWithBotNow: () => {}
      };
    }
    const randomChallenger = WORLDWIDE_CHALLENGERS[0];
    const matchId = `match_${Date.now()}_local`;
    onMatched(matchId, randomChallenger, true);
    return {
      ticketId,
      cancel: () => {
        isCancelled = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
      },
      pairWithBotNow: () => {}
    };
  }
};

/** Listen in real-time to how many real human players are waiting in the worldwide queue */
export const listenToWorldwideQueueCount = (
  callback: (activeInQueue: number) => void
): (() => void) => {
  try {
    const q = query(
      collection(db, 'matchmaking_queue'),
      where('status', '==', 'waiting')
    );
    return onSnapshot(
      q,
      snap => {
        const now = Date.now();
        let liveCount = 0;
        snap.forEach(docSnap => {
          const d = docSnap.data();
          const lastActive = d.lastPing || d.createdAt || 0;
          if (now - lastActive < 45000) {
            liveCount++;
          }
        });
        callback(liveCount);
      },
      err => {
        console.warn('Queue count listener notice:', err.message);
        callback(0);
      }
    );
  } catch {
    callback(0);
    return () => {};
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

export const resolveFate = async (matchId: string, choice: 'execute' | 'spare', actingUid: string) => {
  try {
    const matchRef = doc(db, 'online_matches', matchId);
    const snap = await getDoc(matchRef);
    if (!snap.exists()) throw new Error('Match not found');
    const session = snap.data() as OnlineMatchSession;

    if (session.status !== 'awaiting_fate') throw new Error('Match is not awaiting fate');

    const winnerColor = session.winner;
    if (!winnerColor || winnerColor === 'draw') throw new Error('No winner to decide fate');

    const winnerUid = winnerColor === 'w' ? session.whitePlayer?.uid : session.blackPlayer?.uid;
    if (winnerUid !== actingUid) throw new Error('Only the winner can decide fate');

    const finalResult = choice === 'execute' ? 'executed' : 'mercied';
    const finalReason = choice === 'execute' ? 'Executed' : 'Spared';

    await safeUpdateDoc(matchRef, {
      status: 'completed',
      reason: finalReason,
      updatedAt: new Date().toISOString()
    });

    // Log the execution/mercy
    await logCompletedGame({
      mode: 'online_match',
      opponentName: winnerColor === 'w' ? session.blackPlayer?.displayName || 'Opponent' : session.whitePlayer?.displayName || 'Opponent',
      opponentAvatar: winnerColor === 'w' ? session.blackPlayer?.avatar : session.whitePlayer?.avatar,
      opponentElo: winnerColor === 'w' ? session.blackPlayer?.elo : session.whitePlayer?.elo,
      playerColor: winnerColor,
      result: finalResult,
      reason: finalReason,
      movesCount: session.moves?.length || 0,
      timeControlName: session.timeControl?.name || 'Rapid',
      pgn: session.pgn || '',
      finalFen: session.fen,
      respectChange: choice === 'execute' ? 35 : 15, // Custom respect values
      eloChange: 20,
      userId: actingUid
    });

    return true;
  } catch (e: any) {
    console.error('Error resolving fate:', e);
    throw e;
  }
};

export const listenToOnlineMatchSession = (
  matchId: string,
  callback: (session: OnlineMatchSession | null) => void
) => {
  if (!matchId) return () => {};

  // Check if it's a live Grandmaster showcase arena match
  if (isLiveShowcaseArena(matchId)) {
    return subscribeToShowcaseArena(matchId, callback);
  }

  try {
    const docRef = doc(db, 'online_matches', matchId);
    const unsub = onSnapshot(docRef, snap => {
      if (snap.exists()) {
        callback(snap.data() as OnlineMatchSession);
      } else {
        // Fallback: check local storage or in-memory session
        const local = getOnlineMatchSessionLocal(matchId);
        if (local) {
          callback(local);
        } else {
          // If it matches a showcase arena prefix, fallback to showcase
          const showcase = getShowcaseArenaSession(matchId);
          if (showcase) {
            callback(showcase);
          } else {
            callback(null);
          }
        }
      }
    }, err => {
      console.warn('Online match session listener error:', err);
      const local = getOnlineMatchSessionLocal(matchId);
      if (local) callback(local);
      else callback(null);
    });

    return unsub;
  } catch (e) {
    console.error('Failed to listen to online match session:', e);
    const local = getOnlineMatchSessionLocal(matchId);
    if (local) callback(local);
    else callback(null);
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
    whiteId: isHostWhite ? hostPlayer.uid : undefined,
    blackId: isHostWhite ? undefined : hostPlayer.uid,
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
    clocks: {
      white: timeControl.initialSeconds,
      black: timeControl.initialSeconds,
      lastMoveTimestamp: Date.now(),
    },
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
  if (['completed', 'aborted', 'resigned', 'checkmate', 'draw', 'timeout'].includes(session.status)) {
    throw new Error('This match has already ended.');
  }
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
    winner: null,
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

// =========================================================================
// GRANDMASTER SHOWCASE LIVE ARENAS (Real-time moving chess simulations)
// =========================================================================
interface ShowcaseArenaState {
  id: string;
  code: string;
  whitePlayer: OnlineMatchPlayer;
  blackPlayer: OnlineMatchPlayer;
  timeControl: TimeControl;
  moves: string[];
  currentMoveIndex: number;
  whiteSecondsRemaining: number;
  blackSecondsRemaining: number;
  spectatorsCount: number;
  game: Chess;
  createdAt: string;
  updatedAt: string;
}

const INITIAL_SHOWCASE_ARENAS: Array<{
  id: string;
  code: string;
  whitePlayer: OnlineMatchPlayer;
  blackPlayer: OnlineMatchPlayer;
  timeControl: TimeControl;
  moves: string[];
  startMoveIndex: number;
}> = [
  {
    id: 'gm_arena_magnus_hikaru',
    code: 'GM-MAG',
    whitePlayer: {
      uid: 'gm_magnus',
      displayName: 'GM Magnus Carlsen 🇳🇴',
      username: 'magnuscarlsen',
      elo: 2842,
      country: 'Norway',
      flag: '🇳🇴',
      honorRank: 'Grandmaster Champion',
      rankBadge: '👑',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    },
    blackPlayer: {
      uid: 'gm_hikaru',
      displayName: 'GM Hikaru Nakamura 🇺🇸',
      username: 'hikaru',
      elo: 2820,
      country: 'United States',
      flag: '🇺🇸',
      honorRank: 'Grandmaster Champion',
      rankBadge: '👑',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
    },
    timeControl: {
      id: 'tc_blitz_3_0',
      name: 'Blitz 3+0',
      initialSeconds: 180,
      incrementSeconds: 0,
      category: 'blitz'
    },
    moves: [
      'e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6',
      'Be3', 'e5', 'Nb3', 'Be6', 'Qd2', 'Nbd7', 'f3', 'b5', 'a4', 'b4',
      'Nd5', 'Bxd5', 'exd5', 'Nb6', 'Bxb6', 'Qxb6', 'a5', 'Qb7', 'Bc4', 'Be7',
      'O-O', 'O-O', 'Ra4', 'Rab8', 'Qd3', 'Qa7+', 'Kh1', 'Nd7', 'Qd2', 'Rfc8',
      'Bd3', 'Nc5', 'Rxb4', 'Nxd3', 'Rxb8', 'Qxb8', 'Qxd3', 'Qb4', 'Qxa6', 'Rxc2',
      'Qb6', 'Qc4', 'Rg1', 'Rxb2', 'a6', 'Rxb3', 'a7', 'Rxb6', 'a8=Q+', 'Bf8'
    ],
    startMoveIndex: 18
  },
  {
    id: 'gm_arena_alireza_ding',
    code: 'GM-ALI',
    whitePlayer: {
      uid: 'gm_alireza',
      displayName: 'GM Alireza Firouzja 🇫🇷',
      username: 'firouzja2003',
      elo: 2785,
      country: 'France',
      flag: '🇫🇷',
      honorRank: 'Grandmaster Champion',
      rankBadge: '⚡',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
    },
    blackPlayer: {
      uid: 'gm_ding',
      displayName: 'GM Ding Liren 🇨🇳',
      username: 'dingliren',
      elo: 2762,
      country: 'China',
      flag: '🇨🇳',
      honorRank: 'World Champion',
      rankBadge: '🏆',
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80'
    },
    timeControl: {
      id: 'tc_rapid_10_0',
      name: 'Rapid 10m',
      initialSeconds: 600,
      incrementSeconds: 0,
      category: 'rapid'
    },
    moves: [
      'e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'd4', 'Nd6',
      'Bxc6', 'dxc6', 'dxe5', 'Nf5', 'Qxd8+', 'Kxd8', 'h3', 'h6', 'Nc3', 'Ke8',
      'Bf4', 'Be6', 'Rad1', 'Rd8', 'Rxd8+', 'Kxd8', 'Rd1+', 'Kc8', 'g4', 'Ne7',
      'Nd4', 'Bd7', 'Bg3', 'h5', 'f3', 'Nd5', 'Ne4', 'Be7', 'Nf5', 'Bxf5',
      'gxf5', 'Ne3', 'Rd3', 'Nxf5', 'Bf2', 'b6', 'f4', 'Rd8', 'Rxd8+', 'Kxd8'
    ],
    startMoveIndex: 14
  },
  {
    id: 'gm_arena_peshmerga_erbil',
    code: 'GM-PSH',
    whitePlayer: {
      uid: 'gm_peshmerga',
      displayName: 'Peshmerga Champion ☀️',
      username: 'peshmerga_king',
      elo: 2650,
      country: 'Kurdistan',
      flag: '☀️',
      honorRank: 'Peshmerga Tactician',
      rankBadge: '🦅',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
    },
    blackPlayer: {
      uid: 'gm_erbil',
      displayName: 'Erbil Citadel Master ☀️',
      username: 'erbil_tactics',
      elo: 2615,
      country: 'Kurdistan',
      flag: '☀️',
      honorRank: 'Peshmerga Strategist',
      rankBadge: '🛡️',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80'
    },
    timeControl: {
      id: 'tc_rapid_15_10',
      name: 'Rapid 15+10',
      initialSeconds: 900,
      incrementSeconds: 10,
      category: 'rapid'
    },
    moves: [
      'd4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O',
      'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7', 'Ne1', 'Nd7', 'Be3', 'f5',
      'f3', 'f4', 'Bf2', 'g5', 'Nd3', 'Ng6', 'c5', 'Nf6', 'Rc1', 'Rf7',
      'Kh1', 'h5', 'cxd6', 'cxd6', 'Nb5', 'a6', 'Na3', 'b5', 'Rc6', 'g4',
      'Qc2', 'g3', 'Bb6', 'Qf8', 'Rc1', 'Bd7', 'Rc7', 'h4', 'Bf1', 'h3',
      'gxh3', 'Nh4', 'Ne1', 'Bh6'
    ],
    startMoveIndex: 12
  }
];

class ShowcaseArenaManager {
  private arenas: Map<string, ShowcaseArenaState> = new Map();
  private subscribers: Map<string, Set<(session: OnlineMatchSession) => void>> = new Map();
  private globalSubscribers: Set<() => void> = new Set();
  private timer: any = null;

  constructor() {
    this.initArenas();
    this.startRunner();
  }

  private initArenas() {
    for (const def of INITIAL_SHOWCASE_ARENAS) {
      const g = new Chess();
      const movesToPlay = def.moves.slice(0, def.startMoveIndex);
      for (const m of movesToPlay) {
        try { g.move(m); } catch {}
      }

      const whiteSec = Math.max(30, def.timeControl.initialSeconds - Math.floor(def.startMoveIndex / 2) * 5);
      const blackSec = Math.max(30, def.timeControl.initialSeconds - Math.floor(def.startMoveIndex / 2) * 5);

      this.arenas.set(def.id, {
        id: def.id,
        code: def.code,
        whitePlayer: def.whitePlayer,
        blackPlayer: def.blackPlayer,
        timeControl: def.timeControl,
        moves: def.moves,
        currentMoveIndex: def.startMoveIndex,
        whiteSecondsRemaining: whiteSec,
        blackSecondsRemaining: blackSec,
        spectatorsCount: 14 + Math.floor(Math.random() * 25),
        game: g,
        createdAt: new Date(Date.now() - 300000).toISOString(),
        updatedAt: new Date().toISOString()
      });
      this.subscribers.set(def.id, new Set());
    }
  }

  private startRunner() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick();
    }, 4200);
  }

  private tick() {
    let hasChanges = false;
    for (const [id, arena] of this.arenas.entries()) {
      if (arena.currentMoveIndex < arena.moves.length) {
        const nextSan = arena.moves[arena.currentMoveIndex];
        try {
          const moveRes = arena.game.move(nextSan);
          if (moveRes) {
            arena.currentMoveIndex += 1;
            hasChanges = true;
            if (arena.game.turn() === 'w') {
              arena.blackSecondsRemaining = Math.max(5, arena.blackSecondsRemaining - 4);
            } else {
              arena.whiteSecondsRemaining = Math.max(5, arena.whiteSecondsRemaining - 4);
            }
            arena.updatedAt = new Date().toISOString();
          }
        } catch {}
      } else {
        // Reset to initial partial state after complete game
        const def = INITIAL_SHOWCASE_ARENAS.find(d => d.id === id);
        if (def) {
          arena.game = new Chess();
          const movesToPlay = def.moves.slice(0, 6);
          for (const m of movesToPlay) {
            try { arena.game.move(m); } catch {}
          }
          arena.currentMoveIndex = 6;
          arena.whiteSecondsRemaining = def.timeControl.initialSeconds - 15;
          arena.blackSecondsRemaining = def.timeControl.initialSeconds - 15;
          arena.updatedAt = new Date().toISOString();
          hasChanges = true;
        }
      }

      // Notify match-specific subscribers
      const session = this.getSession(id);
      if (session) {
        const subs = this.subscribers.get(id);
        if (subs) {
          subs.forEach(cb => {
            try { cb(session); } catch (err) { console.error('Showcase subscriber error:', err); }
          });
        }
      }
    }

    if (hasChanges) {
      this.globalSubscribers.forEach(cb => {
        try { cb(); } catch {}
      });
    }
  }

  public getSession(id: string): OnlineMatchSession | null {
    const arena = this.arenas.get(id);
    if (!arena) return null;

    const currentHistory = arena.game.history();
    const lastMoveSan = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1] : undefined;
    const historyObj = arena.game.history({ verbose: true });
    const lastMoveObj = historyObj.length > 0 ? historyObj[historyObj.length - 1] : null;

    return {
      id: arena.id,
      code: arena.code,
      hostId: arena.whitePlayer.uid,
      guestId: arena.blackPlayer.uid,
      whitePlayer: arena.whitePlayer,
      blackPlayer: arena.blackPlayer,
      fen: arena.game.fen(),
      pgn: arena.game.pgn(),
      turn: arena.game.turn(),
      status: 'in_progress',
      winner: null,
      timeControl: arena.timeControl,
      whiteSecondsRemaining: arena.whiteSecondsRemaining,
      blackSecondsRemaining: arena.blackSecondsRemaining,
      moves: currentHistory,
      moveCount: currentHistory.length,
      lastMoveFrom: lastMoveObj?.from,
      lastMoveTo: lastMoveObj?.to,
      lastMoveTimestamp: Date.now(),
      createdAt: arena.createdAt,
      updatedAt: arena.updatedAt,
      // Custom spectator count
      reason: `${arena.spectatorsCount} spectators watching live`
    } as any;
  }

  public getAllSessions(): OnlineMatchSession[] {
    const list: OnlineMatchSession[] = [];
    for (const id of this.arenas.keys()) {
      const s = this.getSession(id);
      if (s) list.push(s);
    }
    return list;
  }

  public subscribe(id: string, cb: (session: OnlineMatchSession) => void): () => void {
    if (!this.subscribers.has(id)) {
      this.subscribers.set(id, new Set());
    }
    const set = this.subscribers.get(id)!;
    set.add(cb);
    const initialSession = this.getSession(id);
    if (initialSession) cb(initialSession);

    return () => {
      set.delete(cb);
    };
  }

  public subscribeGlobal(cb: () => void): () => void {
    this.globalSubscribers.add(cb);
    return () => {
      this.globalSubscribers.delete(cb);
    };
  }
}

// Singleton showcase manager
const showcaseManager = new ShowcaseArenaManager();

export const isLiveShowcaseArena = (matchId: string): boolean => {
  return Boolean(matchId && (matchId.startsWith('gm_arena_') || showcaseManager.getSession(matchId) !== null));
};

export const getShowcaseArenaSession = (matchId: string): OnlineMatchSession | null => {
  return showcaseManager.getSession(matchId);
};

export const subscribeToShowcaseArena = (
  matchId: string,
  callback: (session: OnlineMatchSession | null) => void
): (() => void) => {
  return showcaseManager.subscribe(matchId, callback);
};

/**
 * Listens in real-time to active ongoing matches across Firestore and Socket.IO for live spectating
 */
export const listenToActiveLiveMatches = (
  callback: (matches: OnlineMatchSession[]) => void
): (() => void) => {
  let isSubscribed = true;
  let lastFirestoreMatches: OnlineMatchSession[] = [];
  let lastServerMatches: OnlineMatchSession[] = [];

  const mergeAndEmit = () => {
    if (!isSubscribed) return;
    const combined: OnlineMatchSession[] = [...lastFirestoreMatches];

    // Merge server matches
    for (const sm of lastServerMatches) {
      if (!combined.some(m => m.id === sm.id || m.code === sm.code)) {
        combined.push(sm);
      }
    }

    // Always append Grandmaster showcase arenas so users always have rich, live battles to spectate
    const showcaseMatches = showcaseManager.getAllSessions();
    for (const sc of showcaseMatches) {
      if (!combined.some(m => m.id === sc.id || m.code === sc.code)) {
        combined.push(sc);
      }
    }

    // Sort: real human matches first, then by most recently updated
    combined.sort((a, b) => {
      const aIsShowcase = a.id.startsWith('gm_arena_');
      const bIsShowcase = b.id.startsWith('gm_arena_');
      if (aIsShowcase !== bIsShowcase) return aIsShowcase ? 1 : -1;
      const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tB - tA;
    });

    callback(combined);
  };

  try {
    const q = query(
      collection(db, 'online_matches'),
      where('status', 'in', ['in_progress', 'active', 'ready']),
      limit(30)
    );

    const unsubFirestore = onSnapshot(
      q,
      async snap => {
        if (!isSubscribed) return;
        const firestoreMatches: OnlineMatchSession[] = [];
        snap.forEach(docSnap => {
          const data = docSnap.data() as OnlineMatchSession;
          firestoreMatches.push({
            ...data,
            id: data.id || docSnap.id,
            code: data.code || (data as any).gameCode || docSnap.id
          });
        });
        lastFirestoreMatches = firestoreMatches;

        // Also fetch active matches from server if available to merge
        try {
          const res = await fetch('/api/games/live');
          if (res.ok) {
            const serverMatches = await res.json();
            if (Array.isArray(serverMatches)) {
              const parsedServerMatches: OnlineMatchSession[] = [];
              for (const sm of serverMatches) {
                parsedServerMatches.push({
                  id: sm.id || sm.gameId,
                  code: sm.gameCode,
                  hostId: sm.white?.id || 'host',
                  guestId: sm.black?.id || 'guest',
                  whitePlayer: {
                    uid: sm.white?.id || 'p1',
                    displayName: sm.white?.username || 'White',
                    elo: sm.white?.elo_rating || 1200,
                    country: 'Worldwide',
                    flag: '🏳️'
                  },
                  blackPlayer: {
                    uid: sm.black?.id || 'p2',
                    displayName: sm.black?.username || 'Black',
                    elo: sm.black?.elo_rating || 1200,
                    country: 'Worldwide',
                    flag: '🏴'
                  },
                  fen: sm.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                  pgn: '',
                  turn: sm.turn || 'w',
                  status: 'in_progress',
                  winner: null,
                  timeControl: {
                    id: 'live_tc',
                    name: sm.time_control || 'Rapid',
                    initialSeconds: 600,
                    incrementSeconds: 0,
                    category: 'rapid'
                  },
                  whiteSecondsRemaining: sm.whiteSecondsRemaining || 600,
                  blackSecondsRemaining: sm.blackSecondsRemaining || 600,
                  createdAt: sm.created_at || new Date().toISOString(),
                  updatedAt: sm.updated_at || new Date().toISOString()
                });
              }
              lastServerMatches = parsedServerMatches;
            }
          }
        } catch {}

        mergeAndEmit();
      },
      err => {
        console.warn('Active live matches listener notice:', err);
        mergeAndEmit();
      }
    );

    // Also subscribe to showcase manager updates so live move updates re-emit
    const unsubShowcase = showcaseManager.subscribeGlobal(() => {
      mergeAndEmit();
    });

    // Initial immediate emission
    mergeAndEmit();

    return () => {
      isSubscribed = false;
      unsubFirestore();
      unsubShowcase();
    };
  } catch (e) {
    console.error('Failed to listen to active matches:', e);
    mergeAndEmit();
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
    whiteId: currentBlack?.uid || session.blackId || null,
    blackId: currentWhite?.uid || session.whiteId || null,
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
