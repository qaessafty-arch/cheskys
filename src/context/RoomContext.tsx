import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  collection,
  doc,
  getDoc,
  deleteField,
  onSnapshot,
  runTransaction,
  query,
  where,
  serverTimestamp,
  Timestamp,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType, safeAddDoc, safeSetDoc, safeUpdateDoc, safeDeleteDoc } from '../utils/firebase';
import { soundManager } from '../utils/audio';
import { createOnlineMatch, joinOnlineMatch } from '../services/onlineMatchService';
import { OnlineMatchPlayer, TimeControl } from '../types/chess';

export type RoomStatus = 'waiting' | 'ready' | 'in_progress' | 'ended' | 'expired';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface RoomSettings {
  timeControlId: string;
  timeControlName: string;
  initialSeconds: number;
  incrementSeconds: number;
  color: 'white' | 'black' | 'random';
  rated: boolean;
}

export interface RoomInvite {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  status: 'pending' | 'accepted' | 'declined';
  invitedAt: any;
  settings: RoomSettings;
}

export interface UserInvite {
  id: string;
  userId: string;
  roomId: string;
  roomCode: string;
  invitedBy: string;
  invitedByName: string;
  invitedByPhoto?: string;
  status: 'pending' | 'accepted' | 'declined';
  settings: RoomSettings;
  createdAt: any;
}

export interface RoomChatMessage {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  message: string;
  timestamp: any;
  isSystem?: boolean;
}

export interface PrivateRoom {
  roomId?: string;
  roomCode: string;
  creatorId: string;
  creatorName: string;
  creatorPhotoURL?: string;
  creatorElo: number;
  creatorColor?: 'white' | 'black' | 'random';
  opponentId?: string | null;
  opponentName?: string | null;
  opponentPhotoURL?: string;
  opponentElo?: number | null;
  opponentColor?: 'white' | 'black';
  status: RoomStatus;
  settings: RoomSettings;
  createdAt: any;
  expiresAt: any;
  startedAt?: any;
  gameId?: string | null;
  chat?: RoomChatMessage[];
  invites?: Record<string, RoomInvite>;
}

export interface SocketController {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

interface RoomContextType {
  connectionStatus: ConnectionStatus;
  socketInstance: SocketController;
  currentRoom: PrivateRoom | null;
  incomingInvites: UserInvite[];
  loading: boolean;
  joinError: string | null;
  countdown: number | null;
  activeGameId: string | null;
  setCurrentRoom: (room: PrivateRoom | null) => void;
  setJoinError: (v: string | null) => void;
  createRoom: (code: string, settings: RoomSettings) => Promise<PrivateRoom>;
  joinRoom: (code: string) => Promise<PrivateRoom>;
  cancelRoom: (code?: string) => Promise<void>;
  leaveRoom: () => void;
  updateRoomStatus: (status: RoomStatus) => Promise<void>;
  addOpponent: (
    uid: string,
    name: string,
    photoURL?: string,
    elo?: number,
  ) => Promise<void>;
  inviteFriend: (friendUid: string, friendName: string, friendPhotoURL?: string) => Promise<void>;
  acceptInvite: (inviteId: string, roomCode?: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  sendChatMessage: (message: string) => Promise<void>;
  markRoomExpiredIfDue: () => Promise<boolean>;
  dismissActiveGame: () => void;
}

export function useSocketHealthMonitor(
  socket: SocketController,
  status: ConnectionStatus
) {
  useEffect(() => {
    let innerTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    // Monitor connection state. If it remains in 'connecting' for over 5 seconds,
    // force a disconnect and initiate a reconnection with randomized jitter delay to prevent thundering herd issues.
    if (status === 'connecting') {
      const timer = setTimeout(() => {
        if (isCancelled) return;
        console.warn('[SocketHealthMonitor] Connection stalled in "connecting" for >5s. Scheduling forced reconnect...');
        // Randomized jitter delay (250ms - 2250ms) to prevent thundering herd issues
        const jitter = 250 + Math.random() * 2000;
        innerTimer = setTimeout(async () => {
          if (isCancelled) return;
          try {
            console.info('[SocketHealthMonitor] Forcing disconnect and reconnecting with jitter...');
            await socket.disconnect();
            if (isCancelled) return;
            await socket.connect();
            console.info('[SocketHealthMonitor] Reconnect sequence initiated successfully.');
          } catch (e) {
            console.error('[SocketHealthMonitor] Forced reconnection error:', e);
          }
        }, jitter);
      }, 5000);

      return () => {
        isCancelled = true;
        clearTimeout(timer);
        if (innerTimer) clearTimeout(innerTimer);
      };
    }
  }, [status, socket]);
}

export const SocketHealthMonitor: React.FC<{
  socket?: SocketController;
  status?: ConnectionStatus;
}> = ({ socket, status }) => {
  const room = useContext(RoomContext);
  const activeSocket = socket || room?.socketInstance || {
    connect: async () => {},
    disconnect: async () => {},
  };
  const activeStatus = status || room?.connectionStatus || 'disconnected';
  useSocketHealthMonitor(activeSocket, activeStatus);
  return null;
};

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [currentRoom, setCurrentRoom] = useState<PrivateRoom | null>(null);
  const [incomingInvites, setIncomingInvites] = useState<UserInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRoomRef = useRef<PrivateRoom | null>(null);
  const launchedRoomRef = useRef<string | null>(null);
  currentRoomRef.current = currentRoom;

  // Socket adapter for Firebase network state
  const socketInstance: SocketController = useMemo(() => ({
    connect: async () => {
      try {
        await enableNetwork(db);
        console.log('[RoomContext] Firestore network enabled');
      } catch (err: any) {
        console.warn('[RoomContext] enableNetwork warning:', err?.message);
      }
    },
    disconnect: async () => {
      try {
        await disableNetwork(db);
        console.log('[RoomContext] Firestore network disabled');
      } catch (err: any) {
        console.warn('[RoomContext] disableNetwork warning:', err?.message);
      }
    },
  }), []);

  // Socket Health Monitor (Connection stabilization)
  useSocketHealthMonitor(socketInstance, connectionStatus);

  // Resilient player profile resolution (authenticated user or active guest)
  const getActiveProfile = useCallback((): {
    uid: string;
    displayName: string;
    photoURL?: string | null;
    elo: number;
    isGuest: boolean;
  } => {
    if (profile?.uid) {
      return {
        uid: profile.uid,
        displayName: profile.displayName || user?.displayName || 'Player',
        photoURL: profile.photoURL || user?.photoURL || null,
        elo: typeof profile.elo === 'number' ? profile.elo : 1200,
        isGuest: Boolean(profile.isGuest),
      };
    }
    if (user?.uid) {
      return {
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Player',
        photoURL: user.photoURL || null,
        elo: 1200,
        isGuest: false,
      };
    }
    // Check localStorage cached guest
    try {
      const cached = localStorage.getItem('chess_guest_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.uid) {
          return {
            uid: parsed.uid,
            displayName: parsed.displayName || 'Guest Player',
            photoURL: parsed.photoURL || null,
            elo: typeof parsed.elo === 'number' ? parsed.elo : 1200,
            isGuest: true,
          };
        }
      }
    } catch {}

    // Fallback: create resilient guest player and save
    const randId = Math.floor(100 + Math.random() * 900);
    const guestObj = {
      uid: auth.currentUser?.uid || `guest_${Date.now()}_${randId}`,
      displayName: `Guest #${randId}`,
      photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60',
      elo: 1200,
      isGuest: true,
    };
    try {
      localStorage.setItem('chess_guest_profile', JSON.stringify(guestObj));
      localStorage.setItem('chess_active_account', 'guest');
    } catch {}
    return guestObj;
  }, [profile, user]);

  // Ensure background anonymous auth if not signed in
  useEffect(() => {
    if (!auth.currentUser && !user) {
      signInAnonymously(auth).catch((e) => {
        console.warn('[RoomContext] Anonymous sign-in notice:', e?.message);
      });
    }
  }, [user]);

  // Migration helper: Strip legacy bloated fields and backfill subcollections if present
  const cleanUpLegacyRoomDoc = useCallback(async (roomCode: string, data: PrivateRoom) => {
    try {
      const roomRef = doc(db, 'rooms', roomCode);

      // Backfill messages to subcollection if present on doc
      if (Array.isArray(data.chat) && data.chat.length > 0) {
        const msgColl = collection(db, 'rooms', roomCode, 'messages');
        for (const msg of data.chat) {
          if (msg && msg.message) {
            await safeAddDoc(msgColl, {
              userId: msg.userId || 'system',
              userName: msg.userName || 'System',
              userPhotoURL: msg.userPhotoURL || null,
              message: msg.message,
              timestamp: msg.timestamp || serverTimestamp(),
              isSystem: Boolean(msg.isSystem),
              type: msg.isSystem ? 'system' : 'chat',
            }).catch(() => {});
          }
        }
      }

      // Backfill invites to subcollection if present on doc
      if (data.invites && typeof data.invites === 'object') {
        const invitesColl = collection(db, 'rooms', roomCode, 'invites');
        for (const inv of Object.values(data.invites) as any[]) {
          if (inv && inv.userId) {
            await safeAddDoc(invitesColl, {
              userId: inv.userId,
              userName: inv.userName || 'Friend',
              userPhotoURL: inv.userPhotoURL || null,
              status: inv.status || 'pending',
              invitedAt: inv.invitedAt || serverTimestamp(),
              settings: inv.settings || null,
              invitedBy: data.creatorId,
            }).catch(() => {});
          }
        }
      }

      // Prune legacy fields so the document size drops under 1KB
      await safeUpdateDoc(roomRef, {
        chat: deleteField(),
        invites: deleteField(),
      });
    } catch (err) {
      console.warn('Could not auto-prune legacy room fields:', err);
    }
  }, []);

  // 3-second automatic countdown when status is 'ready'
  const startCountdownFlow = useCallback((room: PrivateRoom) => {
    if (countdownTimerRef.current || launchedRoomRef.current === room.roomCode) return;

    let count = 3;
    setCountdown(count);
    soundManager.playCountdownTick(false);

    countdownTimerRef.current = setInterval(async () => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        soundManager.playCountdownTick(false);
      } else {
        clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        setCountdown(null);
        soundManager.playCountdownTick(true);

        // Only the creator launches the session, and only once per room.
        const currentUid = getActiveProfile().uid;
        if (currentUid === room.creatorId && launchedRoomRef.current !== room.roomCode) {
          launchedRoomRef.current = room.roomCode;
          try {
            const hostPlayer: OnlineMatchPlayer = {
              uid: room.creatorId,
              displayName: room.creatorName,
              avatar: room.creatorPhotoURL,
              elo: room.creatorElo,
            };

            const category: 'bullet' | 'blitz' | 'rapid' | 'classical' =
              room.settings.initialSeconds < 180
                ? 'bullet'
                : room.settings.initialSeconds < 600
                ? 'blitz'
                : room.settings.initialSeconds < 1800
                ? 'rapid'
                : 'classical';

            const tc: TimeControl = {
              id: room.settings.timeControlId || 'tc_custom',
              name: room.settings.timeControlName,
              initialSeconds: room.settings.initialSeconds,
              incrementSeconds: room.settings.incrementSeconds,
              category,
            };

            const preferredSide =
              room.settings.color === 'random'
                ? Math.random() < 0.5
                  ? 'w'
                  : 'b'
                : room.settings.color === 'black'
                ? 'b'
                : 'w';

            const gameSessionId = await createOnlineMatch(hostPlayer, tc, preferredSide, room.roomCode);

            // Add opponent to match session
            if (room.opponentId) {
              const opponentPlayer: OnlineMatchPlayer = {
                uid: room.opponentId,
                displayName: room.opponentName || 'Challenger',
                avatar: room.opponentPhotoURL,
                elo: room.opponentElo || 1200,
              };

              try {
                const matchDocRef = doc(db, 'online_matches', gameSessionId);
                const isHostWhite = preferredSide === 'w';
                await safeUpdateDoc(matchDocRef, {
                  [isHostWhite ? 'blackPlayer' : 'whitePlayer']: opponentPlayer,
                  guestId: room.opponentId,
                  status: 'in_progress',
                  updatedAt: new Date().toISOString(),
                });
              } catch (e) {
                console.warn('Match doc update bypassed in startCountdownFlow (quota/offline):', e);
              }
            }

            // Update room to in_progress with gameId
            try {
              const roomDoc = doc(db, 'rooms', room.roomCode);
              await safeUpdateDoc(roomDoc, {
                status: 'in_progress',
                gameId: gameSessionId,
                startedAt: serverTimestamp(),
              });
            } catch (e) {
              console.warn('Room doc update bypassed in startCountdownFlow (quota/offline):', e);
            }

            setActiveGameId(gameSessionId);
          } catch (err: any) {
            console.error('Failed to launch room game session:', err);
          }
        }
      }
    }, 1000);
  }, [getActiveProfile]);

  // Real-time listener for current room
  useEffect(() => {
    if (!currentRoom?.roomCode) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    const roomRef = doc(db, 'rooms', currentRoom.roomCode);
    const unsub = onSnapshot(
      roomRef,
      { includeMetadataChanges: true },
      (docSnap) => {
        // Document received from Firestore backend or cache - mark connection as active
        setConnectionStatus('connected');

        if (!docSnap.exists()) {
          // Room was canceled or deleted
          if (currentRoomRef.current?.status === 'waiting') {
            setCurrentRoom(null);
          }
          return;
        }

        const data = docSnap.data() as PrivateRoom;
        const prevStatus = currentRoomRef.current?.status;
        const prevOpponent = currentRoomRef.current?.opponentId;

        // Auto-cleanup legacy bloated fields if found on existing room
        if (data.chat || data.invites) {
          cleanUpLegacyRoomDoc(currentRoom.roomCode, data);
        }

        setCurrentRoom(data);

        // Opponent just joined
        if (!prevOpponent && data.opponentId && (data.status === 'ready' || data.status === 'waiting')) {
          soundManager.playMatchFound();
        }

        // Handle game start countdown if ready
        if (
          data.status === 'ready' &&
          prevStatus !== 'ready' &&
          prevStatus !== 'in_progress' &&
          launchedRoomRef.current !== data.roomCode
        ) {
          startCountdownFlow(data);
        }

        // If gameId is set and status in_progress, transition to active match
        if (data.status === 'in_progress' && data.gameId) {
          setActiveGameId(data.gameId);
        }
      },
      (error) => {
        setConnectionStatus('disconnected');
        handleFirestoreError(error, OperationType.GET, `rooms/${currentRoom.roomCode}`);
      }
    );

    return () => {
      unsub();
      setConnectionStatus('disconnected');
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
      }
    };
  }, [currentRoom?.roomCode, cleanUpLegacyRoomDoc, startCountdownFlow]);

  // Real-time listener for incoming user invites
  useEffect(() => {
    if (!user) {
      setIncomingInvites([]);
      return;
    }

    const invitesQuery = query(
      collection(db, 'user_invites'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(
      invitesQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as UserInvite));
        setIncomingInvites(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'user_invites');
      }
    );

    return () => unsub();
  }, [user]);

  const createRoom = useCallback(
    async (code: string, settings: RoomSettings): Promise<PrivateRoom> => {
      const activePlayer = getActiveProfile();
      const cleanCode = code.trim().toUpperCase();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

      const creatorColor = settings.color;
      const opponentColor = creatorColor === 'white' ? 'black' : creatorColor === 'black' ? 'white' : 'black';

      // Keep main room document lean (essential metadata only) to strictly avoid 1MB document size limit
      const room: PrivateRoom = {
        roomId: cleanCode,
        roomCode: cleanCode,
        creatorId: activePlayer.uid,
        creatorName: activePlayer.displayName || 'You',
        creatorPhotoURL: activePlayer.photoURL || null,
        creatorElo: typeof activePlayer.elo === 'number' ? activePlayer.elo : 1200,
        creatorColor,
        opponentColor,
        opponentId: null,
        opponentName: null,
        opponentElo: null,
        status: 'waiting',
        settings,
        createdAt: now,
        expiresAt,
      };

      const roomDoc = doc(db, 'rooms', cleanCode);

      // Fast check with a short timeout to prevent slow network/long-polling hangs
      const checkPromise = getDoc(roomDoc);
      const timeoutPromise = new Promise<'timeout'>((res) => setTimeout(() => res('timeout'), 1500));
      try {
        const raceResult = await Promise.race([checkPromise, timeoutPromise]);
        if (raceResult !== 'timeout' && raceResult.exists()) {
          const data = raceResult.data() as PrivateRoom;
          // If the room belongs to someone else and is still active/waiting
          if (data.creatorId && data.creatorId !== activePlayer.uid && data.status === 'waiting') {
            throw new Error('This room code is already active. Please generate a different code.');
          }
        }
      } catch (err: any) {
        if (err?.message?.includes('already active')) {
          throw err;
        }
        // Non-blocking for network hiccups
      }

      // Write room document to Firestore safely FIRST to prevent onSnapshot race conditions
      try {
        await safeSetDoc(roomDoc, {
          ...room,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(expiresAt),
        });
      } catch (err: any) {
        console.warn('[RoomContext] Firestore room creation write bypassed (quota/offline mode):', err?.message);
      }

      // Set the current room locally so user enters the waiting room
      setCurrentRoom(room);
      setJoinError(null);
      soundManager.playNotification();

      // Persist to localStorage and server REST API
      try {
        localStorage.setItem(`chess_room_${cleanCode}`, JSON.stringify(room));
      } catch {}

      try {
        fetch('/api/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customCode: cleanCode,
            timeControl: {
              initialSeconds: settings.initialSeconds,
              incrementSeconds: settings.incrementSeconds,
            },
            side: settings.color,
            playerInfo: {
              uid: activePlayer.uid,
              name: activePlayer.displayName || 'Host',
              elo: activePlayer.elo || 1200,
            }
          })
        }).catch(() => {});
      } catch {}

      // Background non-blocking tasks: Subcollection welcome message & online_matches mirroring
      (async () => {
        // 1. Initial message into subcollection (rooms/{code}/messages)
        try {
          const msgColl = collection(db, 'rooms', cleanCode, 'messages');
          await safeAddDoc(msgColl, {
            userId: 'system',
            userName: 'System',
            message: `Battle room created! Code: ${cleanCode}. Waiting for challenger.`,
            timestamp: serverTimestamp(),
            isSystem: true,
            type: 'system',
          });
        } catch (err) {
          console.warn('Could not write initial room message to subcollection:', err);
        }

        // 2. Mirror into online_matches collection so the room is discoverable and joinable
        try {
          const hostPlayer: OnlineMatchPlayer = {
            uid: activePlayer.uid,
            displayName: activePlayer.displayName || 'Host',
            avatar: activePlayer.photoURL || null,
            elo: typeof activePlayer.elo === 'number' ? activePlayer.elo : 1200,
          };
          const preferredSide = settings.color === 'white' ? 'w' : settings.color === 'black' ? 'b' : 'random';
          const category =
            settings.initialSeconds < 180
              ? 'bullet'
              : settings.initialSeconds < 600
              ? 'blitz'
              : settings.initialSeconds < 1800
              ? 'rapid'
              : 'classical';

          const tc: TimeControl = {
            id: settings.timeControlId || 'tc_custom',
            name: settings.timeControlName,
            initialSeconds: settings.initialSeconds,
            incrementSeconds: settings.incrementSeconds,
            category,
          };
          await createOnlineMatch(hostPlayer, tc, preferredSide, cleanCode);
        } catch (err) {
          console.warn('Could not mirror room to online_matches:', err);
        }
      })().catch((err) => console.warn('Background room setup failed:', err));

      return room;
    },
    [getActiveProfile]
  );

  const joinRoom = useCallback(
    async (code: string): Promise<PrivateRoom> => {
      const activePlayer = getActiveProfile();
      const cleanCode = code.trim().toUpperCase();
      const roomDoc = doc(db, 'rooms', cleanCode);

      let snap: any = null;
      try {
        snap = await getDoc(roomDoc);
      } catch (e) {
        console.warn('Room getDoc notice (proceeding with fallback checks):', e);
      }

      let data: PrivateRoom | null = snap && snap.exists() ? (snap.data() as PrivateRoom) : null;

      // Fallback: check local storage cache
      if (!data) {
        try {
          const cached = localStorage.getItem(`chess_room_${cleanCode}`);
          if (cached) {
            data = JSON.parse(cached);
          }
        } catch {}
      }

      if (!data) {
        // Fallback: check online_matches collection
        try {
          const matchDocRef = doc(db, 'online_matches', cleanCode);
          const matchSnap = await getDoc(matchDocRef);
          if (matchSnap.exists()) {
            const matchSession = matchSnap.data() as any;
            if (matchSession.status !== 'waiting' && matchSession.guestId && matchSession.guestId !== activePlayer.uid) {
              throw new Error('This match is already in progress or completed.');
            }
            if (matchSession.hostId === activePlayer.uid) {
              throw new Error('You are the creator of this match. Share your code with a friend!');
            }

            const guestPlayer: OnlineMatchPlayer = {
              uid: activePlayer.uid,
              displayName: activePlayer.displayName || 'Opponent',
              avatar: activePlayer.photoURL || null,
              elo: typeof activePlayer.elo === 'number' ? activePlayer.elo : 1200,
            };
            await joinOnlineMatch(cleanCode, guestPlayer);
            setActiveGameId(cleanCode);

            const synthRoom: PrivateRoom = {
              roomId: cleanCode,
              roomCode: cleanCode,
              creatorId: matchSession.hostId,
              creatorName: matchSession.whitePlayer?.displayName || 'Host',
              creatorElo: matchSession.whitePlayer?.elo || 1200,
              creatorColor: matchSession.whitePlayer?.uid === matchSession.hostId ? 'white' : 'black',
              opponentColor: matchSession.whitePlayer?.uid === matchSession.hostId ? 'black' : 'white',
              opponentId: activePlayer.uid,
              opponentName: activePlayer.displayName || 'Opponent',
              opponentElo: typeof activePlayer.elo === 'number' ? activePlayer.elo : 1200,
              status: 'in_progress',
              settings: {
                timeControlId: matchSession.timeControl?.id || 'rapid',
                timeControlName: matchSession.timeControl?.name || 'Rapid 10+0',
                initialSeconds: matchSession.timeControl?.initialSeconds || 600,
                incrementSeconds: matchSession.timeControl?.incrementSeconds || 0,
                color: 'random',
                rated: true,
              },
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 600000),
              gameId: cleanCode,
            };
            setCurrentRoom(synthRoom);
            soundManager.playMatchFound();
            return synthRoom;
          }
        } catch (e: any) {
          if (e?.message?.includes('already in progress') || e?.message?.includes('creator of this match')) {
            throw e;
          }
        }

        throw new Error('No room found with that code. Please check and try again.');
      }

      if (data.status !== 'waiting') {
        throw new Error('This room is already in progress or no longer available.');
      }

      if (data.creatorId === activePlayer.uid) {
        throw new Error("You are the creator of this room. Share your code with a friend!");
      }

      const opponentName = activePlayer.displayName || 'Opponent';
      const opponentPhotoURL = activePlayer.photoURL || null;
      const opponentElo = typeof activePlayer.elo === 'number' ? activePlayer.elo : 1200;

      // Claim the room atomically before doing any nonessential writes.
      const updatePayload: Record<string, any> = {
        opponentId: activePlayer.uid,
        opponentName,
        opponentPhotoURL,
        opponentElo,
        status: 'ready',
        updatedAt: serverTimestamp(),
      };
      if (data.chat) updatePayload.chat = deleteField();
      if (data.invites) updatePayload.invites = deleteField();

      let claimedRoom = data;
      try {
        claimedRoom = await runTransaction(db, async (transaction) => {
          const latestSnap = await transaction.get(roomDoc);
          if (!latestSnap.exists()) return data;
          const latestRoom = latestSnap.data() as PrivateRoom;
          if (latestRoom.status !== 'waiting') {
            throw new Error('This room was just joined by another player.');
          }
          if (latestRoom.creatorId === activePlayer.uid) {
            throw new Error("You are the creator of this room. Share your code with a friend!");
          }
          transaction.update(roomDoc, updatePayload);
          return latestRoom;
        });
      } catch (txErr: any) {
        if (
          txErr?.message?.includes('already') ||
          txErr?.message?.includes('another player') ||
          txErr?.message?.includes('creator')
        ) {
          throw txErr;
        }
        console.warn('[Room] Transaction write bypassed (quota/offline fallback):', txErr?.message);
      }

      // Sync into server REST endpoint
      try {
        fetch(`/api/games/${encodeURIComponent(cleanCode)}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerInfo: {
              uid: activePlayer.uid,
              name: opponentName,
              elo: opponentElo,
            }
          })
        }).catch(() => {});
      } catch {}

      // Chat and online-match mirroring are best-effort side effects and must not delay the room claim.
      void safeAddDoc(collection(db, 'rooms', cleanCode, 'messages'), {
        userId: 'system',
        userName: 'System',
        message: `${opponentName} joined the room!`,
        timestamp: serverTimestamp(),
        isSystem: true,
        type: 'system',
      }).catch((err) => console.warn('Could not write join message to subcollection:', err));

      // Also sync into online_matches
      try {
        const guestPlayer: OnlineMatchPlayer = {
          uid: activePlayer.uid,
          displayName: opponentName,
          avatar: opponentPhotoURL,
          elo: opponentElo,
        };
        await joinOnlineMatch(cleanCode, guestPlayer);
      } catch (e) {
        console.warn('Could not sync online match on private room join:', e);
      }

      const joinedRoom: PrivateRoom = {
        ...claimedRoom,
        roomCode: cleanCode,
        opponentId: activePlayer.uid,
        opponentName,
        opponentPhotoURL,
        opponentElo,
        status: 'ready',
      };
      delete joinedRoom.chat;
      delete joinedRoom.invites;

      // Update local storage cache
      try {
        localStorage.setItem(`chess_room_${cleanCode}`, JSON.stringify(joinedRoom));
      } catch {}

      setCurrentRoom(joinedRoom);
      setJoinError(null);
      soundManager.playMatchFound();
      return joinedRoom;
    },
    [getActiveProfile]
  );

  const cancelRoom = useCallback(
    async (code?: string) => {
      const targetCode = code || currentRoom?.roomCode;
      if (!targetCode) return;
      const activePlayer = getActiveProfile();

      try {
        const roomDoc = doc(db, 'rooms', targetCode);
        const snap = await getDoc(roomDoc);
        if (snap.exists()) {
          const data = snap.data() as PrivateRoom;
          if (data.status === 'waiting' && (!data.creatorId || data.creatorId === activePlayer.uid)) {
            await safeDeleteDoc(roomDoc);
          }
        }
      } catch (e) {
        console.warn('Error deleting room during cancel:', e);
      }

      // Also clean up online_matches mirror if waiting
      try {
        const matchRef = doc(db, 'online_matches', targetCode);
        const mSnap = await getDoc(matchRef);
        if (mSnap.exists()) {
          const mData = mSnap.data();
          if (mData.status === 'waiting' && (!mData.hostId || mData.hostId === activePlayer.uid)) {
            await safeDeleteDoc(matchRef).catch(() => {});
          }
        }
      } catch (err) {} finally {
        if (currentRoom?.roomCode === targetCode) {
          setCurrentRoom(null);
          setCountdown(null);
        }
      }
    },
    [currentRoom, getActiveProfile]
  );

  const leaveRoom = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    setCurrentRoom(null);
    setJoinError(null);
    setConnectionStatus('disconnected');
  }, []);

  const updateRoomStatus = useCallback(
    async (status: RoomStatus) => {
      if (!currentRoom) return;
      setCurrentRoom((prev) => (prev ? { ...prev, status } : null));
      try {
        const roomDoc = doc(db, 'rooms', currentRoom.roomCode);
        await safeUpdateDoc(roomDoc, {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (err: any) {
        console.warn('Room updateDoc bypassed (quota/offline):', err?.message);
      }
    },
    [currentRoom]
  );

  const addOpponent = useCallback(
    async (uid: string, name: string, photoURL?: string, elo?: number) => {
      if (!currentRoom) return;
      setCurrentRoom((prev) =>
        prev
          ? {
              ...prev,
              opponentId: uid,
              opponentName: name,
              opponentPhotoURL: photoURL,
              opponentElo: elo,
              status: 'ready',
            }
          : null
      );
      try {
        const roomDoc = doc(db, 'rooms', currentRoom.roomCode);
        await safeUpdateDoc(roomDoc, {
          opponentId: uid,
          opponentName: name,
          opponentPhotoURL: photoURL,
          opponentElo: elo,
          status: 'ready',
          updatedAt: serverTimestamp(),
        });
      } catch (err: any) {
        console.warn('addOpponent updateDoc bypassed (quota/offline):', err?.message);
      }
    },
    [currentRoom]
  );

  const inviteFriend = useCallback(
    async (friendUid: string, friendName: string, friendPhotoURL?: string) => {
      if (!currentRoom) return;
      const activePlayer = getActiveProfile();
      const roomCode = currentRoom.roomCode;
      const roomDoc = doc(db, 'rooms', roomCode);

      try {
        // Create invite in subcollection ONLY
        const invitesColl = collection(roomDoc, 'invites');
        const inviteRef = await safeAddDoc(invitesColl, {
          userId: friendUid,
          userName: friendName,
          userPhotoURL: friendPhotoURL,
          status: 'pending',
          invitedAt: serverTimestamp(),
          settings: currentRoom.settings,
          invitedBy: activePlayer.uid,
        });

        // Also create document in user_invites for direct notification targeting
        const inviteId = inviteRef?.id || `inv_${Date.now()}`;
        const userInviteDoc = doc(db, 'user_invites', inviteId);
        await safeSetDoc(userInviteDoc, {
          id: inviteId,
          userId: friendUid,
          roomId: roomCode,
          roomCode: roomCode,
          invitedBy: activePlayer.uid,
          invitedByName: activePlayer.displayName || 'You',
          invitedByPhoto: activePlayer.photoURL || null,
          status: 'pending',
          settings: currentRoom.settings,
          createdAt: serverTimestamp(),
        });

        // If main room doc has legacy invites map, clean it up to prevent size issues
        if (currentRoom.invites) {
          try {
            await safeUpdateDoc(roomDoc, { invites: deleteField() });
          } catch {}
        }
      } catch (err: any) {
        console.warn('inviteFriend write bypassed (quota/offline):', err?.message);
      }

      soundManager.playChat();
    },
    [currentRoom, getActiveProfile]
  );

  const acceptInvite = useCallback(
    async (inviteId: string, roomCode?: string) => {
      const code = roomCode || currentRoom?.roomCode;
      if (!code) return;

      try {
        // Update user_invites status
        const userInviteRef = doc(db, 'user_invites', inviteId);
        await safeUpdateDoc(userInviteRef, { status: 'accepted' });

        // Update room subcollection invite if possible
        try {
          const roomInviteRef = doc(db, 'rooms', code, 'invites', inviteId);
          await safeUpdateDoc(roomInviteRef, { status: 'accepted' });
        } catch {}

        // Join room as opponent
        await joinRoom(code);
      } catch (err: any) {
        setJoinError(err?.message || 'Could not join invited room.');
      }
    },
    [currentRoom, joinRoom]
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      try {
        const userInviteRef = doc(db, 'user_invites', inviteId);
        await safeUpdateDoc(userInviteRef, { status: 'declined' });
      } catch (err) {
        console.warn('Error declining invite:', err);
      }
    },
    []
  );

  const sendChatMessage = useCallback(
    async (message: string) => {
      if (!currentRoom) return;
      const activePlayer = getActiveProfile();
      const text = message.trim();
      if (!text) return;

      const roomCode = currentRoom.roomCode;
      const roomDoc = doc(db, 'rooms', roomCode);

      try {
        // Write directly into subcollection: rooms/{roomCode}/messages
        const msgColl = collection(roomDoc, 'messages');
        await safeAddDoc(msgColl, {
          userId: activePlayer.uid,
          userName: activePlayer.displayName || 'You',
          userPhotoURL: activePlayer.photoURL || null,
          message: text,
          timestamp: serverTimestamp(),
          isSystem: false,
          type: 'chat',
        });

        // If main room doc has legacy chat array, delete it to keep room document lean
        if (currentRoom.chat) {
          try {
            await safeUpdateDoc(roomDoc, { chat: deleteField() });
          } catch {}
        }
      } catch (err: any) {
        console.warn('sendChatMessage write bypassed (quota/offline):', err?.message);
      }

      soundManager.playChat();
    },
    [currentRoom, getActiveProfile]
  );

  const markRoomExpiredIfDue = useCallback(async (): Promise<boolean> => {
    if (!currentRoom) return false;
    const expiresAt = currentRoom.expiresAt;
    if (!expiresAt) return false;
    const expMs =
      expiresAt instanceof Timestamp
        ? expiresAt.toDate().getTime()
        : new Date(expiresAt).getTime();

    if (Date.now() >= expMs && currentRoom.status === 'waiting') {
      await updateRoomStatus('expired');
      return true;
    }
    return false;
  }, [currentRoom, updateRoomStatus]);

  const dismissActiveGame = useCallback(() => {
    setActiveGameId(null);
    setCurrentRoom(null);
  }, []);

  return (
    <RoomContext.Provider
      value={{
        connectionStatus,
        socketInstance,
        currentRoom,
        incomingInvites,
        loading,
        joinError,
        countdown,
        activeGameId,
        setCurrentRoom,
        setJoinError,
        createRoom,
        joinRoom,
        cancelRoom,
        leaveRoom,
        updateRoomStatus,
        addOpponent,
        inviteFriend,
        acceptInvite,
        declineInvite,
        sendChatMessage,
        markRoomExpiredIfDue,
        dismissActiveGame,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within a RoomProvider');
  return ctx;
};
