/**
 * Friends between real players, stored in Firestore and enforced by the security rules:
 * a request lives at friend_requests/<from>_<to>, and only after the receiver accepts it
 * can both players' users/<uid>/friends/<friendUid> entries be written.
 *
 * Every call reports Firestore's real answer (no silent fallbacks), so the UI never
 * claims something happened that the server refused.
 */
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../utils/firebase';
import { FriendRequestItem, FriendUser, UserRole } from '../types/chess';

export const requestIdFor = (fromUid: string, toUid: string) => `${fromUid}_${toUid}`;

/** A player counts as online if their app checked in within the last two and a half minutes. */
export const ONLINE_WINDOW_MS = 150_000;
export function isRecentlyOnline(presence: any, now = Date.now()): boolean {
  if (!presence || presence.status === 'offline' || !presence.lastSeen) return false;
  const seen = Date.parse(presence.lastSeen);
  return Number.isFinite(seen) && now - seen < ONLINE_WINDOW_MS;
}

const toNumber = (v: any, fallback: number) => (typeof v === 'number' ? v : Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : fallback);

/** Converts a users/<uid> document into a FriendUser, or null for seeded sample players. */
export function toFriendUser(uid: string, d: any): FriendUser | null {
  if (!d || d.isSample || uid.startsWith('gm_')) return null;
  return {
    uid: d.uid || uid,
    displayName: d.displayName || 'Player',
    username: d.username || undefined,
    photoURL: d.photoURL || undefined,
    elo: toNumber(d.elo, 800),
    respectPoints: toNumber(d.respectPoints, 100),
    honorRank: d.honorRank || 'Peshmerga Tactician',
    rankBadge: d.rankBadge || '🌿',
    role: d.role as UserRole,
    badgeNumber: d.badgeNumber,
    isOnline: isRecentlyOnline(d.presence),
    lastSeen: d.presence?.lastSeen,
  };
}

const friendlyError = (e: any, fallback: string) => {
  if (e?.code === 'permission-denied') return 'Not allowed. Make sure you are signed in with Google.';
  if (e?.code === 'unavailable') return 'You seem to be offline. Try again when connected.';
  return e?.message ? `${fallback} (${e.message})` : fallback;
};

// ---- Usernames and the player directory ------------------------------------------------

export const checkUsernameAvailability = async (username: string, currentUid?: string): Promise<boolean> => {
  const normalized = username.trim().toLowerCase().replace(/^@/, '');
  if (normalized.length < 3 || normalized.length > 20) return false;
  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) return false;
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('username', '==', normalized), limit(1)));
    if (snap.empty) return true;
    return snap.docs[0].data().uid === currentUid;
  } catch (e: any) {
    if (e?.code === 'permission-denied') handleFirestoreError(e, OperationType.LIST, 'users');
    return false;
  }
};

// The strongest players, read once and reused for search and suggestions for a few minutes.
let directoryCache: { at: number; players: FriendUser[] } | null = null;
const DIRECTORY_TTL_MS = 3 * 60_000;

async function loadDirectory(): Promise<FriendUser[]> {
  if (directoryCache && Date.now() - directoryCache.at < DIRECTORY_TTL_MS) return directoryCache.players;
  const snap = await getDocs(query(collection(db, 'users'), orderBy('elo', 'desc'), limit(400)));
  const players = snap.docs.map(d => toFriendUser(d.id, d.data())).filter((p): p is FriendUser => !!p);
  directoryCache = { at: Date.now(), players };
  return players;
}

/** Search real players by @username or display name. */
export const searchUsersInDirectory = async (searchQuery: string, currentUid?: string): Promise<FriendUser[]> => {
  const clean = searchQuery.trim().toLowerCase().replace(/^@/, '');
  if (!clean || !auth.currentUser) return [];
  try {
    const found = new Map<string, FriendUser>();
    // Exact-prefix username lookup reaches players outside the cached top list.
    const byUsername = await getDocs(query(collection(db, 'users'), where('username', '>=', clean), where('username', '<=', `${clean}`), limit(20)));
    byUsername.forEach(d => {
      const p = toFriendUser(d.id, d.data());
      if (p) found.set(p.uid, p);
    });
    for (const p of await loadDirectory()) {
      if (p.displayName.toLowerCase().includes(clean) || (p.username || '').toLowerCase().includes(clean)) found.set(p.uid, p);
    }
    found.delete(currentUid || '');
    return [...found.values()].sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || b.elo - a.elo).slice(0, 25);
  } catch (e: any) {
    if (e?.code === 'permission-denied') handleFirestoreError(e, OperationType.LIST, 'users');
    console.error('Error searching users:', e);
    return [];
  }
};

/**
 * Players you might want to add: real accounts close to your rating, online ones first,
 * excluding you, your friends and anyone you already have a request with.
 */
export async function fetchSuggestedPlayers(myUid: string, myElo: number, exclude: Set<string>, max = 6): Promise<FriendUser[]> {
  if (!auth.currentUser) return [];
  try {
    const players = (await loadDirectory()).filter(p => p.uid !== myUid && !exclude.has(p.uid));
    return players
      .map(p => ({ p, score: Math.abs(p.elo - myElo) - (p.isOnline ? 400 : 0) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, max)
      .map(x => x.p);
  } catch (e) {
    console.error('Error loading suggestions:', e);
    return [];
  }
}

// ---- Requests ----------------------------------------------------------------------------

export type RequestResult = { success: boolean; message: string };

export const sendFriendRequest = async (
  currentUser: { uid: string; displayName: string; username?: string; photoURL?: string; elo?: any; honorRank?: string },
  targetUser: { uid: string; displayName: string; username?: string }
): Promise<RequestResult> => {
  if (!auth.currentUser) return { success: false, message: 'Sign in with Google to add friends.' };
  if (currentUser.uid === targetUser.uid) return { success: false, message: 'You cannot add yourself as a friend.' };
  try {
    if ((await getDoc(doc(db, `users/${currentUser.uid}/friends/${targetUser.uid}`))).exists()) {
      return { success: false, message: `You and ${targetUser.displayName} are already friends.` };
    }
    if ((await getDoc(doc(db, `users/${currentUser.uid}/blocked/${targetUser.uid}`))).exists()) {
      return { success: false, message: 'You have blocked this player. Unblock them first.' };
    }
    // They already asked you: adding them back accepts their request.
    const reverse = await getDoc(doc(db, 'friend_requests', requestIdFor(targetUser.uid, currentUser.uid)));
    if (reverse.exists() && reverse.data().status === 'pending') {
      await respondToFriendRequest(reverse.id, true, currentUser.uid, targetUser.uid);
      return { success: true, message: `You and ${targetUser.displayName} are now friends!` };
    }
    const ref = doc(db, 'friend_requests', requestIdFor(currentUser.uid, targetUser.uid));
    const existing = await getDoc(ref);
    if (existing.exists()) {
      if (existing.data().status === 'pending') return { success: false, message: 'Your request is already waiting for an answer.' };
      // A declined or old request is replaced by a fresh one.
      await deleteDoc(ref);
    }
    await setDoc(ref, {
      fromUserId: currentUser.uid,
      fromUserName: currentUser.displayName || 'Player',
      fromUsername: currentUser.username || '',
      fromUserAvatar: currentUser.photoURL || '',
      fromUserElo: toNumber(currentUser.elo, 800),
      fromUserHonorRank: currentUser.honorRank || 'Peshmerga Tactician',
      toUserId: targetUser.uid,
      toUsername: targetUser.username || '',
      toUserName: targetUser.displayName || 'Player',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    return { success: true, message: `Friend request sent to ${targetUser.displayName}.` };
  } catch (e: any) {
    console.error('Error sending friend request:', e);
    return { success: false, message: friendlyError(e, 'Could not send the request.') };
  }
};

/** Accept or decline. Accepting writes both players' friend entries, which the rules now allow. */
export const respondToFriendRequest = async (requestId: string, accept: boolean, currentUserId: string, otherUserId: string): Promise<boolean> => {
  try {
    await updateDoc(doc(db, 'friend_requests', requestId), { status: accept ? 'accepted' : 'declined', updatedAt: new Date().toISOString() });
    if (!accept) return true;
    const addedAt = new Date().toISOString();
    await setDoc(doc(db, `users/${currentUserId}/friends/${otherUserId}`), { friendUid: otherUserId, addedAt });
    await setDoc(doc(db, `users/${otherUserId}/friends/${currentUserId}`), { friendUid: currentUserId, addedAt });
    return true;
  } catch (e) {
    console.error('Error responding to friend request:', e);
    return false;
  }
};

export const cancelFriendRequest = async (requestId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'friend_requests', requestId));
    return true;
  } catch (e) {
    console.error('Error cancelling friend request:', e);
    return false;
  }
};

/** Pending requests sent to you, and your own requests still waiting for an answer. */
export const listenToFriendRequests = (userId: string, callback: (incoming: FriendRequestItem[], outgoing: FriendRequestItem[]) => void) => {
  if (!userId || !auth.currentUser) {
    callback([], []);
    return () => {};
  }
  let incoming: FriendRequestItem[] = [];
  let outgoing: FriendRequestItem[] = [];
  const unsubIn = onSnapshot(
    query(collection(db, 'friend_requests'), where('toUserId', '==', userId), where('status', '==', 'pending')),
    snap => {
      incoming = snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequestItem));
      callback(incoming, outgoing);
    },
    err => console.warn('Incoming requests:', err.message)
  );
  const unsubOut = onSnapshot(
    query(collection(db, 'friend_requests'), where('fromUserId', '==', userId), where('status', '==', 'pending')),
    snap => {
      outgoing = snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequestItem));
      callback(incoming, outgoing);
    },
    err => console.warn('Outgoing requests:', err.message)
  );
  return () => {
    unsubIn();
    unsubOut();
  };
};

// ---- Friends -----------------------------------------------------------------------------

/** Your friends with their live profile and online status. */
export const listenToFriendsList = (userId: string, callback: (friends: FriendUser[]) => void) => {
  if (!userId || !auth.currentUser) {
    callback([]);
    return () => {};
  }
  let profileUnsubs: (() => void)[] = [];
  const profiles = new Map<string, FriendUser>();
  let order: string[] = [];
  const emit = () => callback(order.map(id => profiles.get(id)).filter((f): f is FriendUser => !!f));

  const unsubFriends = onSnapshot(
    collection(db, `users/${userId}/friends`),
    snap => {
      order = snap.docs.map(d => d.id);
      profileUnsubs.forEach(u => u());
      profileUnsubs = [];
      for (const id of [...profiles.keys()]) if (!order.includes(id)) profiles.delete(id);
      if (order.length === 0) {
        callback([]);
        return;
      }
      // Friends' profiles are watched live (in groups of 30, Firestore's "in" limit) so
      // ratings and online status stay current while the list is open.
      for (let i = 0; i < order.length; i += 30) {
        const chunk = order.slice(i, i + 30);
        profileUnsubs.push(
          onSnapshot(
            query(collection(db, 'users'), where(documentId(), 'in', chunk)),
            s => {
              s.forEach(d => {
                const f = toFriendUser(d.id, d.data());
                if (f) profiles.set(d.id, f);
              });
              emit();
            },
            err => console.warn('Friend profiles:', err.message)
          )
        );
      }
    },
    err => {
      console.warn('Friends list:', err.message);
      callback([]);
    }
  );

  // Online status depends on time passing, so it is re-evaluated every half minute.
  const ticker = setInterval(() => {
    let changed = false;
    for (const [id, f] of profiles) {
      const online = f.lastSeen ? Date.now() - Date.parse(f.lastSeen) < ONLINE_WINDOW_MS : false;
      if (f.isOnline && !online) {
        profiles.set(id, { ...f, isOnline: false });
        changed = true;
      }
    }
    if (changed) emit();
  }, 30_000);

  return () => {
    clearInterval(ticker);
    unsubFriends();
    profileUnsubs.forEach(u => u());
  };
};

/** Deletes a document if it exists (deleting a missing request is not allowed by the rules). */
async function deleteIfExists(path: string) {
  const ref = doc(db, path);
  try {
    if ((await getDoc(ref)).exists()) await deleteDoc(ref);
  } catch (e: any) {
    if (e?.code !== 'permission-denied') throw e;
  }
}

/** Ends the friendship on both sides; the accepted request goes first so it cannot be reused. */
export const removeFriendRelationship = async (userId: string, friendId: string): Promise<boolean> => {
  try {
    await deleteIfExists(`friend_requests/${requestIdFor(userId, friendId)}`);
    await deleteIfExists(`friend_requests/${requestIdFor(friendId, userId)}`);
    await deleteDoc(doc(db, `users/${userId}/friends/${friendId}`));
    await deleteDoc(doc(db, `users/${friendId}/friends/${userId}`));
    return true;
  } catch (e) {
    console.error('Error removing friend:', e);
    return false;
  }
};

export const blockUser = async (currentUid: string, targetUid: string, targetName: string): Promise<boolean> => {
  try {
    await setDoc(doc(db, `users/${currentUid}/blocked/${targetUid}`), { uid: targetUid, displayName: targetName, blockedAt: new Date().toISOString() });
    await removeFriendRelationship(currentUid, targetUid);
    return true;
  } catch (e) {
    console.error('Failed to block user', e);
    return false;
  }
};

export const unblockUser = async (currentUid: string, targetUid: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, `users/${currentUid}/blocked/${targetUid}`));
    return true;
  } catch (e) {
    console.error('Failed to unblock user', e);
    return false;
  }
};

export const listenToBlockedUsers = (userId: string, callback: (blocked: { uid: string; displayName: string }[]) => void) => {
  if (!userId || !auth.currentUser) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, `users/${userId}/blocked`),
    snap => callback(snap.docs.map(d => ({ uid: d.id, displayName: d.data().displayName || 'Player' }))),
    err => console.warn('Blocked users:', err.message)
  );
};
