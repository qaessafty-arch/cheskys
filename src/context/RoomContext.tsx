import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
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
import { db, handleFirestoreError, OperationType, safeAddDoc, safeSetDoc, safeUpdateDoc, safeDeleteDoc } from '../utils/firebase';
import { soundManager } from '../utils/audio';
import { socketService } from '../utils/socket';
import { toast } from 'sonner';
import { createOnlineMatch, joinOnlineMatch, recordLocalUserCreatedRoom } from '../services/onlineMatchService';
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

interface RoomContextType {
  connectionStatus: ConnectionStatus;
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
  socket: { connect: () => Promise<void>; disconnect: () => Promise<void> },
  status: ConnectionStatus
) {
  useEffect(() => {
    if (status === 'connecting') {
      const timer = setTimeout(() => {
        console.warn('SocketHealthMonitor: connection stalled, forcing reconnect...');
        const jitter = Math.random() * 2000;
        setTimeout(async () => {
          try {
            await socket.disconnect();
            await socket.connect();
            console.log('Socket reconnect attempt executed.');
          } catch (e) {
            console.error('Forced reconnect failed:', e);
          }
        }, jitter);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, socket]);
}

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
        // If we received data from the server, mark as connected
        if (!docSnap.metadata.fromCache) {
          setConnectionStatus('connected');
        }

        if (!docSnap.exists()) {
          // Room was canceled or deleted
          if (currentRoomRef.current?.status === 'waiting') {
            const timeSinceCreation = Date.now() - (new Date(currentRoomRef.current?.createdAt).getTime() || 0);
            if (timeSinceCreation > 15000) {
              console.warn("[RoomContext] Resetting currentRoom to null because docSnap does not exist");
              setCurrentRoom(null);
            } else {
              console.warn("[RoomContext] docSnap does not exist, but room was just created. Bypassing reset.");
            }
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
        handleFirestoreError(error, OperationType.GET, `rooms/${currentRoom.roomCode}`);
      }
    );

    return () => {
      unsub();
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
      }
    };
  }, [currentRoom?.roomCode, cleanUpLegacyRoomDoc]);

  // Socket adapter for Firebase network state
  const socketInstance = useRef({
    connect: () => enableNetwork(db),
    disconnect: () => disableNetwork(db),
  }).current;

  // Socket Health Monitor (Connection stabilization)
  useSocketHealthMonitor(socketInstance, connectionStatus);

  // Real-time listener for incoming user invites
  useEffect(() => {
    if (!user) {
      setIncomingInvites([]);
      return;
    }

    // Connect global socket for WebSockets
    socketService.connect(user.uid);
    const globalSocket = socketService.getSocket();
    
    const onInviteReceived = (data: any) => {
      const newInvite: UserInvite = {
        id: data.inviteId,
        userId: data.friendUid,
        roomId: data.roomCode,
        roomCode: data.roomCode,
        invitedBy: 'socket',
        invitedByName: data.inviterName || 'A friend',
        invitedByPhoto: data.inviterPhoto || null,
        status: 'pending',
        settings: {
          timeControlId: 'rapid',
          timeControlName: '10 min',
          initialSeconds: 600,
          incrementSeconds: 0,
          rated: false,
          color: 'random',
        },
        createdAt: new Date().toISOString()
      };
      
      setIncomingInvites(prev => {
        if (prev.find(inv => inv.id === newInvite.id)) return prev;
        return [newInvite, ...prev];
      });

      // Play sound
      soundManager.playNotification();

      toast('Game Invite Received', {
        description: `${newInvite.invitedByName} invited you to room ${newInvite.roomCode}.`,
        duration: 30000,
        action: {
          label: 'Accept',
          onClick: () => {
            window.dispatchEvent(new CustomEvent('room_invite_response', { 
              detail: { status: 'accepted', inviteId: newInvite.id, roomCode: newInvite.roomCode } 
            }));
          }
        },
        cancel: {
          label: 'Decline',
          onClick: () => {
            window.dispatchEvent(new CustomEvent('room_invite_response', { 
              detail: { status: 'declined', inviteId: newInvite.id, roomCode: newInvite.roomCode } 
            }));
          }
        },
      });
      
      window.dispatchEvent(new CustomEvent('new_socket_invite', { detail: newInvite }));
    };

    if (globalSocket) {
      globalSocket.on('receive_invite', onInviteReceived);
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
        setIncomingInvites(prev => {
          // Merge with socket invites to avoid overriding
          const merged = [...list];
          prev.forEach(p => {
            if (!merged.find(m => m.id === p.id) && p.invitedBy === 'socket') {
              merged.push(p);
            }
          });
          return merged;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'user_invites');
      }
    );

    return () => {
      unsub();
      if (globalSocket) {
        globalSocket.off('receive_invite', onInviteReceived);
      }
    };
  }, [user]);

  // 3-second automatic countdown when status is 'ready'
  const startCountdownFlow = (room: PrivateRoom) => {
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
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
        soundManager.playCountdownTick(true);

        // Only the creator launches the session, and only once per room.
        if (profile?.uid === room.creatorId && launchedRoomRef.current !== room.roomCode) {
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
        } else if (profile?.uid !== room.creatorId) {
          // Transition opponent into active match session
          const targetGameId = room.gameId || room.roomCode;
          setActiveGameId(targetGameId);
        }
      }
    }, 1000);
  };

  const createRoom = useCallback(
    async (code: string, settings: RoomSettings): Promise<PrivateRoom> => {
      const activeProfile = profile || {
        uid: 'guest_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        displayName: 'Guest Challenger',
        photoURL: null,
        elo: 1200
      };
      
      const cleanCode = code.trim().toUpperCase();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

      const creatorColor = settings.color;
      const opponentColor = creatorColor === 'white' ? 'black' : creatorColor === 'black' ? 'white' : 'black';

      // Keep main room document lean (essential metadata only) to strictly avoid 1MB document size limit
      const room: PrivateRoom = {
        roomId: cleanCode,
        roomCode: cleanCode,
        creatorId: activeProfile.uid,
        creatorName: activeProfile.displayName || 'You',
        creatorPhotoURL: activeProfile.photoURL || null,
        creatorElo: typeof activeProfile.elo === 'number' ? activeProfile.elo : 1200,
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
          if (data.creatorId && data.creatorId !== profile.uid && data.status === 'waiting') {
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
        recordLocalUserCreatedRoom({
          code: cleanCode,
          hostId: activeProfile.uid,
          timeControl: {
            id: settings.timeControlId || 'tc_custom',
            name: settings.timeControlName,
            initialSeconds: settings.initialSeconds,
            incrementSeconds: settings.incrementSeconds,
            category: settings.initialSeconds < 600 ? 'blitz' : 'rapid',
          },
          side: settings.color === 'white' ? 'w' : settings.color === 'black' ? 'b' : 'random',
          status: 'waiting',
          createdAt: now.toISOString(),
        });
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
              uid: activeProfile.uid,
              name: activeProfile.displayName || 'Host',
              elo: activeProfile.elo || 1200,
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
            uid: profile.uid,
            displayName: profile.displayName || 'Host',
            avatar: profile.photoURL || null,
            elo: typeof profile.elo === 'number' ? profile.elo : 1200,
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
    [profile]
  );

  const joinRoom = useCallback(
    async (code: string, inviteFallback?: Partial<UserInvite>): Promise<PrivateRoom> => {
      const activeProfile = profile || {
        uid: 'guest_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        displayName: 'Guest Challenger',
        photoURL: null,
        elo: 1200
      };
      
      const cleanCode = (code || inviteFallback?.roomCode || inviteFallback?.roomId || '').trim().toUpperCase();
      if (!cleanCode) {
        throw new Error('No room code provided. Please enter a valid room code.');
      }

      let snap: any = null;
      const roomDoc = doc(db, 'rooms', cleanCode);

      // Strategy 1: Direct doc lookup by code in rooms collection
      try {
        snap = await getDoc(roomDoc);
      } catch (e) {
        console.warn('Room getDoc notice (proceeding with fallback checks):', e);
      }

      // Strategy 2: Query rooms by roomCode or roomId field
      if (!snap || !snap.exists()) {
        try {
          const qRoomCode = query(collection(db, 'rooms'), where('roomCode', '==', cleanCode), limit(1));
          const snapRooms = await getDocs(qRoomCode);
          if (!snapRooms.empty) {
            snap = snapRooms.docs[0];
          } else {
            const qRoomId = query(collection(db, 'rooms'), where('roomId', '==', cleanCode), limit(1));
            const snapRoomsById = await getDocs(qRoomId);
            if (!snapRoomsById.empty) {
              snap = snapRoomsById.docs[0];
            }
          }
        } catch (e) {
          console.warn('Rooms collection query notice:', e);
        }
      }

      let data: PrivateRoom | null = snap && snap.exists() ? (snap.data() as PrivateRoom) : null;

      // Strategy 3: Check local storage cache
      if (!data) {
        try {
          const cached = localStorage.getItem(`chess_room_${cleanCode}`);
          if (cached) {
            data = JSON.parse(cached);
          }
        } catch {}
      }

      // Strategy 4: Fallback to online_matches collection
      if (!data) {
        try {
          const matchDocRef = doc(db, 'online_matches', cleanCode);
          let matchSnap = await getDoc(matchDocRef);
          if (!matchSnap.exists()) {
            const qMatches = query(collection(db, 'online_matches'), where('code', '==', cleanCode), limit(1));
            const matchDocs = await getDocs(qMatches);
            if (!matchDocs.empty) {
              matchSnap = matchDocs.docs[0];
            }
          }

          if (matchSnap && matchSnap.exists()) {
            const matchSession = matchSnap.data() as any;
            const guestPlayer: OnlineMatchPlayer = {
              uid: activeProfile.uid,
              displayName: activeProfile.displayName || 'Opponent',
              avatar: activeProfile.photoURL || null,
              elo: typeof activeProfile.elo === 'number' ? activeProfile.elo : 1200,
            };
            await joinOnlineMatch(cleanCode, guestPlayer);
            setActiveGameId(matchSnap.id || cleanCode);

            const synthRoom: PrivateRoom = {
              roomId: matchSnap.id || cleanCode,
              roomCode: cleanCode,
              creatorId: matchSession.hostId,
              creatorName: matchSession.whitePlayer?.displayName || 'Host',
              creatorElo: matchSession.whitePlayer?.elo || 1200,
              creatorColor: matchSession.whitePlayer?.uid === matchSession.hostId ? 'white' : 'black',
              opponentColor: matchSession.whitePlayer?.uid === matchSession.hostId ? 'black' : 'white',
              opponentId: activeProfile.uid,
              opponentName: activeProfile.displayName || 'Opponent',
              opponentElo: typeof activeProfile.elo === 'number' ? activeProfile.elo : 1200,
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
              gameId: matchSnap.id || cleanCode,
            };
            setCurrentRoom(synthRoom);
            soundManager.playMatchFound();
            return synthRoom;
          }
        } catch (e: any) {
          console.warn('online_matches lookup notice:', e?.message);
        }
      }

      // Strategy 5: Direct joinOnlineMatch attempt (supports in-memory server & REST games)
      if (!data) {
        try {
          const guestPlayer: OnlineMatchPlayer = {
            uid: activeProfile.uid,
            displayName: activeProfile.displayName || 'Opponent',
            avatar: activeProfile.photoURL || null,
            elo: typeof activeProfile.elo === 'number' ? activeProfile.elo : 1200,
          };
          const session = await joinOnlineMatch(cleanCode, guestPlayer);
          if (session) {
            setActiveGameId(session.id || cleanCode);
            const synthRoom: PrivateRoom = {
              roomId: session.id || cleanCode,
              roomCode: cleanCode,
              creatorId: session.hostId || 'host',
              creatorName: session.whitePlayer?.displayName || 'Host',
              creatorElo: session.whitePlayer?.elo || 1200,
              creatorColor: session.whitePlayer?.uid === session.hostId ? 'white' : 'black',
              opponentColor: session.whitePlayer?.uid === session.hostId ? 'black' : 'white',
              opponentId: activeProfile.uid,
              opponentName: activeProfile.displayName || 'Opponent',
              opponentElo: typeof activeProfile.elo === 'number' ? activeProfile.elo : 1200,
              status: 'in_progress',
              settings: {
                timeControlId: session.timeControl?.id || 'rapid',
                timeControlName: session.timeControl?.name || 'Rapid 10+0',
                initialSeconds: session.timeControl?.initialSeconds || 600,
                incrementSeconds: session.timeControl?.incrementSeconds || 0,
                color: 'random',
                rated: true,
              },
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 600000),
              gameId: session.id || cleanCode,
            };
            setCurrentRoom(synthRoom);
            soundManager.playMatchFound();
            return synthRoom;
          }
        } catch (joinErr: any) {
          console.warn('Direct joinOnlineMatch notice:', joinErr?.message);
        }
      }

      // Strategy 6: Synthesize from inviteFallback (or matching pending incoming invite)
      const matchedInvite =
        inviteFallback ||
        incomingInvites.find((i) => i.roomCode === cleanCode || i.roomId === cleanCode);

      if (!data && matchedInvite) {
        const synthRoom: PrivateRoom = {
          roomId: cleanCode,
          roomCode: cleanCode,
          creatorId: matchedInvite.invitedBy || 'host',
          creatorName: matchedInvite.invitedByName || 'Challenger',
          creatorElo: 1200,
          creatorColor: matchedInvite.settings?.color === 'black' ? 'black' : 'white',
          opponentColor: matchedInvite.settings?.color === 'black' ? 'white' : 'black',
          opponentId: activeProfile.uid,
          opponentName: activeProfile.displayName || 'Opponent',
          opponentPhotoURL: activeProfile.photoURL || undefined,
          opponentElo: typeof activeProfile.elo === 'number' ? activeProfile.elo : 1200,
          status: 'ready',
          settings: matchedInvite.settings || {
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

        // Best effort write back to rooms collection so host can observe
        safeSetDoc(doc(db, 'rooms', cleanCode), synthRoom).catch(() => {});
        try {
          localStorage.setItem(`chess_room_${cleanCode}`, JSON.stringify(synthRoom));
        } catch {}

        setCurrentRoom(synthRoom);
        setActiveGameId(cleanCode);
        soundManager.playMatchFound();
        return synthRoom;
      }

      if (!data) {
        throw new Error('No room found with that code. Please check and try again.');
      }

      // If room is already in progress or ready, admit player directly into active match!
      if (data.status === 'in_progress' || (data.status === 'ready' && data.opponentId === activeProfile.uid)) {
        const targetGame = data.gameId || data.roomCode || cleanCode;
        setActiveGameId(targetGame);
        setCurrentRoom(data);
        soundManager.playMatchFound();
        return data;
      }

      const opponentName = activeProfile.displayName || 'Opponent';
      const opponentPhotoURL = activeProfile.photoURL || null;
      const opponentElo = typeof activeProfile.elo === 'number' ? activeProfile.elo : 1200;

      // Claim the room atomically before doing any nonessential writes.
      const updatePayload: Record<string, any> = {
        opponentId: activeProfile.uid,
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
            return latestRoom;
          }
          transaction.update(roomDoc, updatePayload);
          return latestRoom;
        });
      } catch (txErr: any) {
        console.warn('[Room] Transaction write bypassed (quota/offline fallback):', txErr?.message);
        try {
          await safeUpdateDoc(roomDoc, updatePayload);
        } catch (fallbackErr) {
          console.warn('Fallback safeUpdateDoc also failed:', fallbackErr);
        }
      }

      // Sync into server REST endpoint
      try {
        fetch(`/api/games/${encodeURIComponent(cleanCode)}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerInfo: {
              uid: activeProfile.uid,
              name: opponentName,
              elo: opponentElo,
            },
          }),
        }).catch(() => {});
      } catch {}

      // Notify socket
      const globalSocket = socketService.getSocket();
      if (globalSocket) {
        globalSocket.emit('join_room', {
          roomCode: cleanCode,
          user: {
            uid: activeProfile.uid,
            displayName: opponentName,
            photoURL: opponentPhotoURL,
            elo: opponentElo,
          },
        });
      }

      // Best effort join chat message
      void safeAddDoc(collection(db, 'rooms', cleanCode, 'messages'), {
        userId: 'system',
        userName: 'System',
        message: `${opponentName} joined the room!`,
        timestamp: serverTimestamp(),
        isSystem: true,
        type: 'system',
      }).catch((err) => console.warn('Could not write join message to subcollection:', err));

      const joinedRoom: PrivateRoom = {
        ...claimedRoom,
        roomCode: cleanCode,
        opponentId: activeProfile.uid,
        opponentName,
        opponentPhotoURL,
        opponentElo,
        status: 'ready',
      };
      delete joinedRoom.chat;
      delete joinedRoom.invites;

      try {
        localStorage.setItem(`chess_room_${cleanCode}`, JSON.stringify(joinedRoom));
      } catch {}

      setCurrentRoom(joinedRoom);
      setJoinError(null);
      soundManager.playMatchFound();
      startCountdownFlow(joinedRoom);
      return joinedRoom;
    },
    [profile, incomingInvites, startCountdownFlow]
  );

  const cancelRoom = useCallback(
    async (code?: string) => {
      const targetCode = code || currentRoom?.roomCode;
      if (!targetCode) return;

      try {
        const roomDoc = doc(db, 'rooms', targetCode);
        const snap = await getDoc(roomDoc);
        if (snap.exists()) {
          const data = snap.data() as PrivateRoom;
          if (data.status === 'waiting' && (!profile || data.creatorId === profile.uid)) {
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
          if (mData.status === 'waiting' && (!profile || mData.hostId === profile.uid)) {
            await safeDeleteDoc(matchRef).catch(() => {});
          }
        }
      } catch (err) {} finally {
        if (currentRoom?.roomCode === targetCode) {
          console.warn("[RoomContext] Resetting currentRoom to null because docSnap does not exist"); setCurrentRoom(null);
          setCountdown(null);
        }
      }
    },
    [currentRoom, profile]
  );

  const leaveRoom = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    console.warn("[RoomContext] Resetting currentRoom to null because docSnap does not exist"); setCurrentRoom(null);
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
      if (!currentRoom || !profile) return;
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
          invitedBy: profile.uid,
        });

        // Also create document in user_invites for direct notification targeting
        const inviteId = inviteRef?.id || `inv_${Date.now()}`;
        const userInviteDoc = doc(db, 'user_invites', inviteId);
        await safeSetDoc(userInviteDoc, {
          id: inviteId,
          userId: friendUid,
          roomId: roomCode,
          roomCode: roomCode,
          invitedBy: profile.uid,
          invitedByName: profile.displayName || 'You',
          invitedByPhoto: profile.photoURL || null,
          status: 'pending',
          settings: currentRoom.settings,
          createdAt: serverTimestamp(),
        });

        // Fire WebSocket event for instant delivery bypassing Firestore
        const globalSocket = socketService.getSocket();
        if (globalSocket) {
          globalSocket.emit('send_invite', {
            friendUid,
            roomCode,
            inviterName: profile.displayName || 'You',
            inviterPhoto: profile.photoURL || null
          });
        }

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
    [currentRoom, profile]
  );

  const acceptInvite = useCallback(
    async (inviteId: string, roomCode?: string) => {
      const targetInvite = incomingInvites.find(
        (inv) => inv.id === inviteId || inv.roomCode === roomCode || inv.roomId === roomCode
      );
      const code = roomCode || targetInvite?.roomCode || targetInvite?.roomId || currentRoom?.roomCode;
      if (!code) {
        setJoinError('Room code not found in invite.');
        return;
      }

      // Optimistically remove from local list
      setIncomingInvites((prev) => prev.filter((inv) => inv.id !== inviteId));

      try {
        // Update user_invites status
        const userInviteRef = doc(db, 'user_invites', inviteId);
        try {
          await safeUpdateDoc(userInviteRef, { status: 'accepted' });
        } catch {}

        // Update room subcollection invite if possible
        try {
          const roomInviteRef = doc(db, 'rooms', code, 'invites', inviteId);
          await safeUpdateDoc(roomInviteRef, { status: 'accepted' });
        } catch {}

        // Join room as opponent, passing fallback targetInvite
        await joinRoom(code, targetInvite);
      } catch (err: any) {
        console.error('[RoomContext] Failed to join invited room:', err);
        setJoinError(err?.message || 'Could not join invited room.');
      }
    },
    [currentRoom, incomingInvites, joinRoom]
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      // Optimistically remove from local list
      setIncomingInvites((prev) => prev.filter((inv) => inv.id !== inviteId));

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
      if (!currentRoom || !profile) return;
      const text = message.trim();
      if (!text) return;

      const roomCode = currentRoom.roomCode;
      const roomDoc = doc(db, 'rooms', roomCode);

      try {
        // Write directly into subcollection: rooms/{roomCode}/messages
        const msgColl = collection(roomDoc, 'messages');
        await safeAddDoc(msgColl, {
          userId: profile.uid,
          userName: profile.displayName || 'You',
          userPhotoURL: profile.photoURL || null,
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
    [currentRoom, profile]
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
    console.warn("[RoomContext] Resetting currentRoom to null because docSnap does not exist"); setCurrentRoom(null);
  }, []);

  return (
    <RoomContext.Provider
      value={{
        connectionStatus,
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
