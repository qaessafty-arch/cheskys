import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db, safeSetDoc } from './firebase';
import { PrivateRoom, UserInvite } from '../context/RoomContext';
import { OnlineMatchPlayer } from '../types/chess';
import { joinOnlineMatch } from '../services/onlineMatchService';

export interface ResolvedRoomResult {
  room: PrivateRoom;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  tierName: string;
  source: string;
  isOnlineMatch?: boolean;
  gameId?: string;
  alreadyStarted?: boolean;
  synthesize?: boolean;
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
 * Ensures a valid UID exists to prevent "Cannot read properties of null" crashes.
 */
export function getHydratedProfile(profile?: any, user?: any): HydratedProfile {
  const source = profile || user;
  if (source && source.uid) {
    return {
      uid: String(source.uid),
      displayName: source.displayName || source.name || 'Chessky Player',
      photoURL: source.photoURL || source.avatar || null,
      elo: typeof source.elo === 'number' ? source.elo : 1200,
    };
  }

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
 * The Resilient Room Resolution Engine (6-Tier Lookup)
 */
export async function resolveRoom(
  rawCode: string,
  userProfile?: any,
  targetInvite?: Partial<UserInvite> | null
): Promise<ResolvedRoomResult | null> {
  const cleanCode = normalizeRoomCode(rawCode || targetInvite?.roomCode || targetInvite?.roomId);
  if (!cleanCode) return null;

  const activeProfile = getHydratedProfile(userProfile);

  // Tier 1: Direct Document Key
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
  } catch (err: any) {
    console.warn('[RoomResolver] Tier 1 error:', err);
  }

  // Tier 2: Indexed Field Query
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
    }
  } catch (err: any) {
    console.warn('[RoomResolver] Tier 2 error:', err);
  }

  // Tier 3: Local Storage Cache
  try {
    const cachedStr = localStorage.getItem(`chess_room_${cleanCode}`);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr) as PrivateRoom;
      return {
        room: cached,
        tier: 3,
        tierName: 'Local Storage Cache',
        source: `localStorage`,
        gameId: cached.gameId || undefined,
        alreadyStarted: cached.status === 'in_progress' || cached.status === 'ready',
      };
    }
  } catch (err: any) {
    console.warn('[RoomResolver] Tier 3 error:', err);
  }

  // Tier 4: Online Matches Collection
  try {
    const qMatches = query(collection(db, 'online_matches'), where('code', '==', cleanCode), limit(1));
    const matchDocs = await getDocs(qMatches);
    if (!matchDocs.empty) {
      const matchDocSnap = matchDocs.docs[0];
      const matchData = matchDocSnap.data() as any;
      const gameId = matchDocSnap.id;

      // Silent join to online match
      await joinOnlineMatch(gameId, {
        uid: activeProfile.uid,
        displayName: activeProfile.displayName,
        avatar: activeProfile.photoURL,
        elo: activeProfile.elo,
      }).catch(() => {});

      return {
        room: {
          roomCode: cleanCode,
          creatorId: matchData.hostId || 'host',
          creatorName: matchData.whitePlayer?.displayName || 'Host',
          status: 'in_progress',
          settings: {
            timeControlId: matchData.timeControl?.id || 'rapid',
            timeControlName: matchData.timeControl?.name || 'Rapid',
            initialSeconds: matchData.timeControl?.initialSeconds || 600,
            incrementSeconds: matchData.timeControl?.incrementSeconds || 0,
            color: 'random',
            rated: true,
          } as any,
        } as PrivateRoom,
        tier: 4,
        tierName: 'Online Match',
        source: `online_matches/${gameId}`,
        isOnlineMatch: true,
        gameId,
        alreadyStarted: true,
      };
    }
  } catch (err: any) {
    console.warn('[RoomResolver] Tier 4 error:', err);
  }

  // Tier 5: Server-Side Fallback
  try {
    const res = await fetch(`/api/rooms/join/${encodeURIComponent(cleanCode)}`, { method: 'POST' });
    if (res.ok) {
      const serverData = await res.json();
      return {
        room: { roomCode: cleanCode, status: 'ready' } as PrivateRoom,
        tier: 5,
        tierName: 'Server Fallback',
        source: 'API',
        gameId: serverData.gameId,
        alreadyStarted: true,
      };
    }
  } catch (e) {}

  // Tier 6: Invite Fallback Synthesis
  if (targetInvite) {
    const synthRoom: PrivateRoom = {
      roomId: cleanCode,
      roomCode: cleanCode,
      creatorId: targetInvite.invitedBy || 'host',
      creatorName: targetInvite.invitedByName || 'Host',
      status: 'ready',
      settings: targetInvite.settings || {
        timeControlId: 'rapid',
        timeControlName: 'Rapid 10+0',
        initialSeconds: 600,
        incrementSeconds: 0,
        color: 'random',
        rated: true,
      } as any,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
      gameId: null,
    };

    // Sync synthesized room to DB so host can see the join
    await safeSetDoc(doc(db, 'rooms', cleanCode), synthRoom).catch(() => {});

    return {
      room: synthRoom,
      tier: 6,
      tierName: 'Invite Synthesis',
      source: 'synthesized',
      synthesize: true,
    };
  }

  return null;
}

export default resolveRoom;
