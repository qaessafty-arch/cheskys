import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db, safeSetDoc } from './firebase';
import { PrivateRoom, UserInvite } from '../context/RoomContext';
import { OnlineMatchPlayer, TimeControl } from '../types/chess';
import { joinOnlineMatch } from '../services/onlineMatchService';

export interface ResolvedRoomResult {
  room: PrivateRoom;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  tierName: string;
  source: string;
  isOnlineMatch?: boolean;
  gameId?: string;
  alreadyStarted?: boolean;
}

export interface HydratedProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  elo: number;
}

/**
 * Normalization constraint: Every single room code check MUST use .trim().toUpperCase().
 */
export function normalizeRoomCode(code: string | null | undefined): string {
  if (!code) return '';
  return code.trim().toUpperCase();
}

/**
 * Profile Hydration "Guest Defense":
 * If activeProfile is null or missing uid, generate a temporary session ID (guest_ + UUID)
 * to prevent Cannot read properties of null (reading 'uid') crashes.
 */
export function getHydratedProfile(profile?: any): HydratedProfile {
  if (profile && profile.uid) {
    return {
      uid: String(profile.uid),
      displayName: profile.displayName || profile.name || 'Chessky Player',
      photoURL: profile.photoURL || profile.avatar || null,
      elo: typeof profile.elo === 'number' ? profile.elo : 1200,
    };
  }

  // Generate robust guest UUID
  const randomSuffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    uid: `guest_${randomSuffix}`,
    displayName: 'Guest Challenger',
    photoURL: null,
    elo: 1200,
  };
}

/**
 * The Resilient Room Resolution Engine (6-Tier Lookup):
 * 1. Direct Document Key: doc(db, 'rooms', cleanCode)
 * 2. Indexed Field Query: collection(db, 'rooms') where roomCode == cleanCode or roomId == cleanCode
 * 3. Local Storage Cache: Inspect localStorage for recent active room sessions
 * 4. Online Matches Collection: Query online_matches collection by code == cleanCode or match doc id
 * 5. Server-Side Fallback: Route through /api/rooms/join/${cleanCode} to check in-memory Node.js/Socket.io rooms
 * 6. Invite Fallback Synthesis: Synthesize new room session using verified invite parameters & write to Firestore
 */
export async function resolveRoom(
  rawCode: string,
  userProfile?: any,
  targetInvite?: Partial<UserInvite> | null
): Promise<ResolvedRoomResult | null> {
  const cleanCode = normalizeRoomCode(rawCode || targetInvite?.roomCode || targetInvite?.roomId);
  if (!cleanCode) return null;

  const activeProfile = getHydratedProfile(userProfile);

  // =========================================================================
  // Tier 1: Direct Document Key lookup
  // =========================================================================
  try {
    const directDocRef = doc(db, 'rooms', cleanCode);
    const snap = await getDoc(directDocRef);
    if (snap.exists()) {
      const room = snap.data() as PrivateRoom;
      return {
        room: { ...room, roomCode: cleanCode },
        tier: 1,
        tierName: 'Direct Document Key',
        source: `rooms/${cleanCode}`,
        gameId: room.gameId || undefined,
        alreadyStarted: room.status === 'in_progress' || room.status === 'ready',
      };
    }

    // Secondary check: lowercase variant key if created by legacy client
    if (cleanCode.toLowerCase() !== cleanCode) {
      const lowerSnap = await getDoc(doc(db, 'rooms', cleanCode.toLowerCase()));
      if (lowerSnap.exists()) {
        const room = lowerSnap.data() as PrivateRoom;
        return {
          room: { ...room, roomCode: cleanCode },
          tier: 1,
          tierName: 'Direct Document Key (lowercase)',
          source: `rooms/${cleanCode.toLowerCase()}`,
          gameId: room.gameId || undefined,
          alreadyStarted: room.status === 'in_progress' || room.status === 'ready',
        };
      }
    }
  } catch (err: any) {
    console.warn('[RoomResolver] Tier 1 Direct Doc notice:', err?.message || err);
  }

  // =========================================================================
  // Tier 2: Indexed Field Query (roomCode, roomId, or code field match)
  // =========================================================================
  try {
    const fields = ['roomCode', 'roomId', 'code'];
    for (const field of fields) {
      const q = query(collection(db, 'rooms'), where(field, '==', cleanCode), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const docSnap = querySnap.docs[0];
        const room = docSnap.data() as PrivateRoom;
        return {
          room: { ...room, roomCode: cleanCode, roomId: docSnap.id },
          tier: 2,
          tierName: `Indexed Field Query (${field})`,
          source: `rooms/${docSnap.id}`,
          gameId: room.gameId || undefined,
          alreadyStarted: room.status === 'in_progress' || room.status === 'ready',
        };
      }

      if (cleanCode.toLowerCase() !== cleanCode) {
        const qLower = query(collection(db, 'rooms'), where(field, '==', cleanCode.toLowerCase()), limit(1));
        const queryLowerSnap = await getDocs(qLower);
        if (!queryLowerSnap.empty) {
          const docSnap = queryLowerSnap.docs[0];
          const room = docSnap.data() as PrivateRoom;
          return {
            room: { ...room, roomCode: cleanCode, roomId: docSnap.id },
            tier: 2,
            tierName: `Indexed Field Query (${field} lowercase)`,
            source: `rooms/${docSnap.id}`,
            gameId: room.gameId || undefined,
            alreadyStarted: room.status === 'in_progress' || room.status === 'ready',
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[RoomResolver] Tier 2 Indexed Query notice:', err?.message || err);
  }

  // =========================================================================
  // Tier 3: Local Storage Cache
  // =========================================================================
  try {
    const cachedStr = localStorage.getItem(`chess_room_${cleanCode}`);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr) as PrivateRoom;
      if (cached && (cached.roomCode === cleanCode || cached.roomId === cleanCode)) {
        return {
          room: cached,
          tier: 3,
          tierName: 'Local Storage Cache',
          source: `localStorage[chess_room_${cleanCode}]`,
          gameId: cached.gameId || undefined,
          alreadyStarted: cached.status === 'in_progress' || cached.status === 'ready',
        };
      }
    }
  } catch (err: any) {
    console.warn('[RoomResolver] Tier 3 LocalStorage notice:', err?.message || err);
  }

  // =========================================================================
  // Tier 4: Online Matches Collection Query
  // =========================================================================
  try {
    let matchDocSnap: any = null;
    const directMatchRef = doc(db, 'online_matches', cleanCode);
    const directSnap = await getDoc(directMatchRef);
    if (directSnap.exists()) {
      matchDocSnap = directSnap;
    } else {
      const qMatches = query(collection(db, 'online_matches'), where('code', '==', cleanCode), limit(1));
      const matchDocs = await getDocs(qMatches);
      if (!matchDocs.empty) {
        matchDocSnap = matchDocs.docs[0];
      }
    }

    if (matchDocSnap && matchDocSnap.exists()) {
      const matchData = matchDocSnap.data() as any;
      const gameId = matchDocSnap.id || cleanCode;

      // Join online match as guest player
      const guestPlayer: OnlineMatchPlayer = {
        uid: activeProfile.uid,
        displayName: activeProfile.displayName,
        avatar: activeProfile.photoURL,
        elo: activeProfile.elo,
      };

      try {
        await joinOnlineMatch(gameId, guestPlayer);
      } catch {}

      const synthRoom: PrivateRoom = {
        roomId: gameId,
        roomCode: cleanCode,
        creatorId: matchData.hostId || matchData.whitePlayer?.uid || 'host',
        creatorName: matchData.whitePlayer?.displayName || 'Host',
        creatorPhotoURL: matchData.whitePlayer?.avatar || undefined,
        creatorElo: matchData.whitePlayer?.elo || 1200,
        creatorColor: matchData.whitePlayer?.uid === matchData.hostId ? 'white' : 'black',
        opponentColor: matchData.whitePlayer?.uid === matchData.hostId ? 'black' : 'white',
        opponentId: activeProfile.uid,
        opponentName: activeProfile.displayName,
        opponentPhotoURL: activeProfile.photoURL || undefined,
        opponentElo: activeProfile.elo,
        status: matchData.status === 'waiting' ? 'ready' : 'in_progress',
        settings: {
          timeControlId: matchData.timeControl?.id || 'rapid',
          timeControlName: matchData.timeControl?.name || 'Rapid 10+0',
          initialSeconds: matchData.timeControl?.initialSeconds || 600,
          incrementSeconds: matchData.timeControl?.incrementSeconds || 0,
          color: 'random',
          rated: true,
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
        gameId,
      };

      return {
        room: synthRoom,
        tier: 4,
        tierName: 'Online Matches Collection',
        source: `online_matches/${gameId}`,
        isOnlineMatch: true,
        gameId,
        alreadyStarted: true,
      };
    }
  } catch (err: any) {
    console.warn('[RoomResolver] Tier 4 Online Matches notice:', err?.message || err);
  }

  // =========================================================================
  // Tier 5: Server-Side Fallback (/api/rooms/join/${cleanCode} & /api/games/${cleanCode}/join)
  // =========================================================================
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`/api/rooms/join/${encodeURIComponent(cleanCode)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerInfo: {
          uid: activeProfile.uid,
          displayName: activeProfile.displayName,
          elo: activeProfile.elo,
        },
      }),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok) {
      const serverData = await res.json();
      if (serverData.success) {
        const gameId = serverData.gameId || serverData.gameCode || cleanCode;
        const synthRoom: PrivateRoom = {
          roomId: gameId,
          roomCode: cleanCode,
          creatorId: serverData.hostId || 'host',
          creatorName: serverData.hostName || 'Host',
          creatorElo: serverData.hostElo || 1200,
          creatorColor: serverData.playerColor === 'black' ? 'white' : 'black',
          opponentColor: serverData.playerColor === 'black' ? 'black' : 'white',
          opponentId: activeProfile.uid,
          opponentName: activeProfile.displayName,
          opponentElo: activeProfile.elo,
          status: 'ready',
          settings: {
            timeControlId: 'rapid',
            timeControlName: '10+0 Rapid',
            initialSeconds: 600,
            incrementSeconds: 0,
            color: 'random',
            rated: true,
          },
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 600000),
          gameId,
        };

        return {
          room: synthRoom,
          tier: 5,
          tierName: 'Server-Side In-Memory / Socket.io Fallback',
          source: `/api/rooms/join/${cleanCode}`,
          gameId,
          alreadyStarted: true,
        };
      }
    }
  } catch (err: any) {
    console.warn('[RoomResolver] Tier 5 Server Fallback notice:', err?.message || err);
  }

  // =========================================================================
  // Tier 6: Invite Fallback Synthesis
  // =========================================================================
  if (targetInvite) {
    const synthRoom: PrivateRoom = {
      roomId: cleanCode,
      roomCode: cleanCode,
      creatorId: targetInvite.invitedBy || 'host',
      creatorName: targetInvite.invitedByName || 'Challenger',
      creatorPhotoURL: targetInvite.invitedByPhoto,
      creatorElo: 1200,
      creatorColor: targetInvite.settings?.color === 'black' ? 'black' : 'white',
      opponentColor: targetInvite.settings?.color === 'black' ? 'white' : 'black',
      opponentId: activeProfile.uid,
      opponentName: activeProfile.displayName,
      opponentPhotoURL: activeProfile.photoURL || undefined,
      opponentElo: activeProfile.elo,
      status: 'ready',
      settings: targetInvite.settings || {
        timeControlId: 'rapid',
        timeControlName: 'Rapid 10+0',
        initialSeconds: 600,
        incrementSeconds: 0,
        color: 'random',
        rated: true,
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
      gameId: cleanCode,
    };

    // Synchronize synthesized room to Firestore so creator detects join immediately
    try {
      await safeSetDoc(doc(db, 'rooms', cleanCode), synthRoom);
    } catch (writeErr) {
      console.warn('[RoomResolver] Safe write synthRoom notice:', writeErr);
    }

    try {
      localStorage.setItem(`chess_room_${cleanCode}`, JSON.stringify(synthRoom));
    } catch {}

    return {
      room: synthRoom,
      tier: 6,
      tierName: 'Invite Fallback Synthesis',
      source: 'synthesized_from_invite',
      gameId: cleanCode,
      alreadyStarted: false,
    };
  }

  return null;
}

export default resolveRoom;

