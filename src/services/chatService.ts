import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  getDocs,
  Timestamp,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { db, safeAddDoc, safeSetDoc } from '../utils/firebase';
import { DirectMessageItem } from '../types/chess';

// --- Direct Messages (Private Friends Chat) ---
// Only friends can write to each other; the rules check that from the chat id.

// Derives a deterministic Chat ID for any two users
export const getChatId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join('_');
};

export type DirectMessageType = 'text' | 'quick' | 'voice' | 'challenge';

export interface OutgoingDirectMessage {
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  senderBadge?: string;
  text: string;
  type?: DirectMessageType;
  /** Voice clip as a data: URL (Opus or AAC), at most about 30 seconds. */
  audio?: string;
  audioMs?: number;
  challengeData?: any;
}

const preview = (m: OutgoingDirectMessage) =>
  m.type === 'voice' ? '🎤 Voice message' : m.type === 'challenge' ? '⚔️ Game challenge' : m.text.slice(0, 120);

/** Sends a message and updates the chat summary. Throws if Firestore refuses it. */
export const sendDirectMessage = async (chatId: string, message: OutgoingDirectMessage): Promise<string> => {
  const now = new Date().toISOString();
  const clean: Record<string, unknown> = { ...message, type: message.type || 'text', createdAt: now };
  for (const k of Object.keys(clean)) if (clean[k] === undefined) delete clean[k];
  const ref = await addDoc(collection(db, `direct_messages/${chatId}/messages`), clean);
  await setDoc(
    doc(db, 'direct_messages', chatId),
    { lastMessage: preview(message), lastMessageTime: now, senderId: message.senderId, [`lastRead_${message.senderId}`]: now },
    { merge: true }
  );
  return ref.id;
};

// Listen to private messages in real-time (the latest 100).
export const listenToDirectMessages = (
  chatId: string,
  callback: (messages: DirectMessageItem[]) => void,
  onError?: (message: string) => void
) => {
  if (!chatId) return () => {};
  const q = query(collection(db, `direct_messages/${chatId}/messages`), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, chatId, ...d.data() } as DirectMessageItem)).reverse()),
    err => {
      console.warn('Direct messages listener error:', err);
      onError?.(err.code === 'permission-denied' ? 'You can only chat with your friends.' : 'Could not load messages.');
    }
  );
};

/** Marks the chat as read by `uid` (used for read receipts and unread dots). */
export const markChatRead = async (chatId: string, uid: string) => {
  try {
    await setDoc(doc(db, 'direct_messages', chatId), { [`lastRead_${uid}`]: new Date().toISOString() }, { merge: true });
  } catch {
    // Not friends any more, or offline: nothing to mark.
  }
};

export interface ChatMeta {
  lastMessage?: string;
  lastMessageTime?: string;
  senderId?: string;
  [key: `lastRead_${string}`]: string | undefined;
}

export const listenToChatMeta = (chatId: string, callback: (meta: ChatMeta | null) => void) =>
  onSnapshot(
    doc(db, 'direct_messages', chatId),
    snap => callback(snap.exists() ? (snap.data() as ChatMeta) : null),
    () => callback(null)
  );

/** Friends with a message you have not read yet. */
export const listenToUnreadChats = (myUid: string, friendUids: string[], callback: (unread: Set<string>) => void) => {
  const unread = new Set<string>();
  const unsubs = friendUids.map(friendUid =>
    listenToChatMeta(getChatId(myUid, friendUid), meta => {
      const isUnread = !!meta?.lastMessageTime && meta.senderId !== myUid && (!meta[`lastRead_${myUid}`] || meta[`lastRead_${myUid}`]! < meta.lastMessageTime);
      if (isUnread) unread.add(friendUid);
      else unread.delete(friendUid);
      callback(new Set(unread));
    })
  );
  return () => unsubs.forEach(u => u());
};

/** Typing indicator: refreshed while typing, cleared on send. */
export const setDirectTyping = async (chatId: string, uid: string, typing: boolean) => {
  try {
    const ref = doc(db, `direct_messages/${chatId}/typing/${uid}`);
    if (typing) await setDoc(ref, { at: new Date().toISOString() });
    else await deleteDoc(ref);
  } catch {
    // Typing hints are best effort.
  }
};

export const listenToDirectTyping = (chatId: string, otherUid: string, callback: (typing: boolean) => void) =>
  onSnapshot(
    doc(db, `direct_messages/${chatId}/typing/${otherUid}`),
    snap => callback(snap.exists() && Date.now() - Date.parse(snap.data().at) < 8000),
    () => callback(false)
  );

/** Answers a game challenge sent in the chat. */
export const setChallengeStatus = async (chatId: string, messageId: string, challengeData: any, status: 'accepted' | 'declined') => {
  await updateDoc(doc(db, `direct_messages/${chatId}/messages/${messageId}`), { challengeData: { ...challengeData, status } });
};

// --- In-Game Match Chat (Live Arena Chat) ---

export interface InGameMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  type: 'text' | 'canned' | 'emote' | 'system';
  timestamp: any; // serverTimestamp
}

export const sendInGameMessage = async (
  gameId: string,
  message: Omit<InGameMessage, 'id' | 'timestamp'>
): Promise<string | null> => {
  try {
    const messagesRef = collection(db, `online_matches/${gameId}/chat`);
    const docRef = await safeAddDoc(messagesRef, {
      ...message,
      timestamp: serverTimestamp()
    });
    return docRef?.id || 'offline_chat';
  } catch (e) {
    console.error('Error sending in-game message:', e);
    return null;
  }
};

export const listenToInGameMessages = (
  gameId: string,
  callback: (messages: InGameMessage[]) => void
) => {
  if (!gameId) return () => {};

  try {
    const q = query(
      collection(db, `online_matches/${gameId}/chat`),
      orderBy('timestamp', 'asc'),
      limit(200)
    );

    const unsub = onSnapshot(q, snap => {
      const msgs: InGameMessage[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          // Handle potential null timestamp immediately after sending
          timestamp: data.timestamp ? (data.timestamp as Timestamp).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'
        } as unknown as InGameMessage;
      });
      callback(msgs);
    }, err => {
      console.warn('In-game chat listener error:', err);
    });

    return unsub;
  } catch (e) {
    console.error('Failed to listen to in-game messages:', e);
    return () => {};
  }
};

export const setInGameTypingStatus = async (
  gameId: string,
  uid: string,
  isTyping: boolean
) => {
  try {
    const typingDocRef = doc(db, `online_matches/${gameId}/typing`, uid);
    await safeSetDoc(typingDocRef, {
      isTyping,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.error('Error setting typing status:', e);
  }
};

export const listenToInGameTypingStatus = (
  gameId: string,
  callback: (typingMap: Record<string, boolean>) => void
) => {
  if (!gameId) return () => {};

  try {
    const typingRef = collection(db, `online_matches/${gameId}/typing`);
    const unsub = onSnapshot(typingRef, snap => {
      const typingMap: Record<string, boolean> = {};
      snap.forEach(d => {
        const data = d.data();
        // Only count as typing if updated in last 5 seconds to prevent stale states
        const lastUpdate = data.updatedAt ? (data.updatedAt as Timestamp).toMillis() : 0;
        const now = Date.now();
        if (data.isTyping && now - lastUpdate < 5000) {
          typingMap[d.id] = true;
        }
      });
      callback(typingMap);
    }, err => {
      console.warn('Typing status listener error:', err);
    });

    return unsub;
  } catch (e) {
    console.error('Failed to listen to typing status:', e);
    return () => {};
  }
};
