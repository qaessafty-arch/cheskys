import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db, safeSetDoc } from './firebase';
import { PrivateRoom, UserInvite } from '../context/RoomContext';

export interface ResolvedRoomResult {
  room: PrivateRoom;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  tierName: string;
  source: string;
  gameId?: string;
  alreadyStarted?: boolean;
  synthesize?: boolean;
}

export function normalizeRoomCode(code: string | null | undefined): string {
  if (!code) return '';
  return code.trim().toUpperCase();
}

export function getHydratedProfile(profile?: any, user?: any) {
  const source = profile || user;
  if (source && source.uid) {
    return {
      uid: String(source.uid),
      displayName: source.displayName || source.name || 'Chessky Player',
      photoURL: source.photoURL || source.avatar || null,
      elo: typeof source.elo === 'number' ? source.elo : 1200,
    };
  }
  return {
    uid: `guest_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()}`,
    displayName: 'Guest Challenger',
    photoURL: null,
    elo: 1200,
  };
}

export async function resolveRoom(
  rawCode: string,
  userProfile?: any,
  targetInvite?: Partial<UserInvite> | null
): Promise<ResolvedRoomResult | null> {
  const cleanCode = normalizeRoomCode(rawCode || targetInvite?.roomCode || targetInvite?.roomId);
  if (!cleanCode) return null;

  // Tier 1: Direct Document
  const directRef = doc(db, 'rooms', cleanCode);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) {
    const room = directSnap.data() as PrivateRoom;
    return { room: { ...room, roomCode: cleanCode }, tier: 1, tierName: 'Direct', source: 'db', gameId: room.gameId, alreadyStarted: room.status === 'in_progress' };
  }

  // Tier 2: Indexed Query
  const q = query(collection(db, 'rooms'), where('roomCode', '==', cleanCode), limit(1));
  const qSnap = await getDocs(q);
  if (!qSnap.empty) {
    const room = qSnap.docs[0].data() as PrivateRoom;
    return { room: { ...room, roomCode: cleanCode }, tier: 2, tierName: 'Indexed', source: 'db', gameId: room.gameId, alreadyStarted: room.status === 'in_progress' };
  }

  // Tier 3: Local Storage
  const cached = localStorage.getItem(`chess_room_${cleanCode}`);
  if (cached) {
    const room = JSON.parse(cached) as PrivateRoom;
    return { room, tier: 3, tierName: 'Cache', source: 'local', gameId: room.gameId, alreadyStarted: room.status === 'in_progress' };
  }

  // Tier 4: Online Matches
  const mQ = query(collection(db, 'online_matches'), where('code', '==', cleanCode), limit(1));
  const mSnap = await getDocs(mQ);
  if (!mSnap.empty) {
    const match = mSnap.docs[0].data() as any;
    return { room: { roomCode: cleanCode, status: 'in_progress' } as any, tier: 4, tierName: 'Match', source: 'matches', gameId: mSnap.docs[0].id, alreadyStarted: true };
  }

  // Tier 5: Server API
  try {
    const res = await fetch(`/api/rooms/join/${cleanCode}`);
    if (res.ok) return { room: await res.json(), tier: 5, tierName: 'Server', source: 'api' };
  } catch {}

  // Tier 6: Synthesis (The Fail-Safe)
  if (targetInvite) {
    const synthRoom: PrivateRoom = {
      roomId: cleanCode,
      roomCode: cleanCode,
      creatorId: targetInvite.invitedBy || 'host',
      creatorName: targetInvite.invitedByName || 'Host',
      status: 'ready',
      settings: targetInvite.settings || { timeControlId: 'rapid', timeControlName: '10+0', initialSeconds: 600, incrementSeconds: 0, color: 'random', rated: true },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
      gameId: null,
    } as any;
    await safeSetDoc(doc(db, 'rooms', cleanCode), synthRoom).catch(() => {});
    return { room: synthRoom, tier: 6, tierName: 'Synthesis', source: 'invite', synthesize: true };
  }

  return null;
}
