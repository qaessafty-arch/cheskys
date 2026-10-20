import { useEffect, useMemo, useState } from 'react';
import { FriendRequestItem, FriendUser } from '../types/chess';
import { listenToBlockedUsers, listenToFriendRequests, listenToFriendsList } from '../services/friendService';
import { listenToUnreadChats } from '../services/chatService';

export type Relation = 'self' | 'friend' | 'requested' | 'incoming' | 'blocked' | 'none';

/** Your friends, requests, blocks and unread chats, kept live from Firestore. */
export function useSocialGraph(uid: string | undefined, enabled = true) {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [blocked, setBlocked] = useState<{ uid: string; displayName: string }[]>([]);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !enabled) {
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setBlocked([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const stop = [
      listenToFriendsList(uid, list => {
        setFriends(list);
        setLoading(false);
      }),
      listenToFriendRequests(uid, (inc, out) => {
        setIncoming(inc);
        setOutgoing(out);
      }),
      listenToBlockedUsers(uid, setBlocked),
    ];
    const fallback = setTimeout(() => setLoading(false), 8000);
    return () => {
      clearTimeout(fallback);
      stop.forEach(s => s());
    };
  }, [uid, enabled]);

  const friendKey = friends.map(f => f.uid).sort().join(',');
  useEffect(() => {
    if (!uid || !enabled || !friendKey) {
      setUnread(new Set());
      return;
    }
    return listenToUnreadChats(uid, friendKey.split(','), setUnread);
  }, [uid, enabled, friendKey]);

  return useMemo(() => {
    const friendIds = new Set(friends.map(f => f.uid));
    const outgoingIds = new Set(outgoing.map(r => r.toUserId));
    const incomingById = new Map(incoming.map(r => [r.fromUserId, r]));
    const blockedIds = new Set(blocked.map(b => b.uid));
    const relationTo = (other: string): Relation =>
      other === uid ? 'self'
        : friendIds.has(other) ? 'friend'
          : blockedIds.has(other) ? 'blocked'
            : incomingById.has(other) ? 'incoming'
              : outgoingIds.has(other) ? 'requested'
                : 'none';
    return { friends, incoming, outgoing, blocked, unread, loading, friendIds, incomingById, relationTo };
  }, [friends, incoming, outgoing, blocked, unread, loading, uid]);
}

export type SocialGraph = ReturnType<typeof useSocialGraph>;
