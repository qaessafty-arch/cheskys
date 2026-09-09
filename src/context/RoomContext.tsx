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
import { createOnlineMatch, verifyOnlineMatchExists } from '../services/matchService';
import { joinOnlineMatch, recordLocalUserCreatedRoom } from '../services/onlineMatchService';
import { OnlineMatchPlayer, TimeControl } from '../types/chess';
import { resolveRoom, normalizeRoomCode, getHydratedProfile } from '../utils/roomResolver';

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
  createPrivateRoom: (
    settingsOrCode?: RoomSettings | string,
    settings?: RoomSettings
  ) => Promise<PrivateRoom>;
  createRoom: (
    codeOrSettings: string | RoomSettings,
    settings?: RoomSettings
  ) => Promise<PrivateRoom>;
  joinRoom: (code: string, inviteFallback?: Partial<UserInvite>) => Promise<PrivateRoom>;
  joinRoomWithContext: (inviteOrCode: string | UserInvite | any) => Promise<PrivateRoom>;
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
  const cleanedUpRoomsRef = useRef<Set<string>>(new Set());
  currentRoomRef.current = currentRoom;

  // Migration helper: Strip legacy bloated fields and backfill subcollections if present
  const cleanUpLegacyRoomDoc = useCallback(async (roomCode: string, data: PrivateRoom) => {
    if (!roomCode || cleanedUpRoomsRef.current.has(roomCode)) return;
    const hasChat = Array.isArray(data.chat) && data.chat.length > 0;
    const hasInvites = data.invites && typeof data.invites === 'object' && Object.keys(data.invites).length > 0;
    if (!hasChat && !hasInvites) return;

    cleanedUpRoomsRef.current.add(roomCode);
    try {
      const roomRef = doc(db, 'rooms', roomCode);

      // Backfill messages to subcollection if present on doc
      if (hasChat) {
        const msgColl = collection(db, 'rooms', roomCode, 'messages');
        for (const msg of data.chat!) {
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
      if (hasInvites) {
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
        if (
          !docSnap.metadata.hasPendingWrites &&
          ((Array.isArray(data.chat) && data.chat.length > 0) ||
            (data.invites && typeof data.invites === 'object' && Object.keys(data.invites).length > 0))
        ) {
          cleanUpLegacyRoomDoc(data.roomCode || currentRoom?.roomCode || '', data);
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

        // If gameId is set and status in_progress, transition to active match ONLY after verified existence
        if (data.status === 'in_progress' && data.gameId) {
          const activeProf = getHydratedProfile(profile || user);
          const currentUid = activeProf.uid;
          if (currentUid === data.creatorId) {
            setActiveGameId(data.gameId);
          } else {
            // Invitee verifies the match document in Firestore before activating game
            verifyOnlineMatchExists(data.gameId).then((exists) => {
              if (exists) {
                setActiveGameId(data.gameId);
              } else {
                console.warn('[RoomContext] Invitee gameId pending verification in Firestore:', data.gameId);
              }
            });
          }
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

  // 3-second automatic countdown when status is 'ready' (Synchronized 3-Second Handshake)
  const startCountdownFlow = (room: PrivateRoom) => {
    const cleanCode = normalizeRoomCode(room.roomCode);
    if (countdownTimerRef.current || launchedRoomRef.current === cleanCode) return;

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

        const activeProfile = getHydratedProfile(profile);

        // Strict Handshake: Creator creates match document, Invitee waits for gameId confirmation
        if (activeProfile.uid === room.creatorId && launchedRoomRef.current !== cleanCode) {
          launchedRoomRef.current = cleanCode;
          try {
            const hostPlayer: OnlineMatchPlayer = {
              uid: room.creatorId,
              displayName: room.creatorName,
              avatar: room.creatorPhotoURL,
              elo: room.creatorElo,
            };

            const opponentPlayer: OnlineMatchPlayer | null = room.opponentId
              ? {
                  uid: room.opponentId,
                  displayName: room.opponentName || 'Challenger',
                  avatar: room.opponentPhotoURL,
                  elo: room.opponentElo || 1200,
                }
              : null;

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

            // Atomically initialize online_matches/{gameId} with starting FEN and strictly mapped colors
            const gameSessionId = await createOnlineMatch(
              hostPlayer,
              tc,
              room.settings.color,
              cleanCode,
              opponentPlayer
            );

            // Verify that the match document is created and reachable in Firestore
            const verified = await verifyOnlineMatchExists(gameSessionId);
            if (!verified) {
              console.warn(`[RoomContext] Match verification notice for ID ${gameSessionId}, proceeding with session.`);
            }

            // Update room to in_progress with gameId for invitee to detect and navigate
            try {
              const roomDoc = doc(db, 'rooms', cleanCode);
              await safeUpdateDoc(roomDoc, {
                status: 'in_progress',
                gameId: gameSessionId,
                startedAt: serverTimestamp(),
              });
            } catch (e) {
              console.warn('[RoomContext] Room doc update notice:', e);
            }

            setActiveGameId(gameSessionId);
          } catch (err: any) {
            console.error('[RoomContext] Failed to launch match session:', err);
          }
        } else if (activeProfile.uid !== room.creatorId) {
          // Invitee: Wait for creator's gameId to be verified in Firestore. NO premature navigation!
          if (room.gameId) {
            verifyOnlineMatchExists(room.gameId).then((exists) => {
              if (exists) {
                setActiveGameId(room.gameId);
              }
            });
          }
        }
      }
    }, 1000);
  };

  /**
   * Generates a unique, uppercase, 6-character room code using a Firestore transaction.
   * Stores the room with 'waiting' status, and only navigates to the WaitingRoom
   * once the server confirms the document's existence in Firestore.
   */
  const createPrivateRoom = useCallback(
    async (
      settingsOrCode?: RoomSettings | string,
      possibleSettings?: RoomSettings
    ): Promise<PrivateRoom> => {
      const activeProfile = getHydratedProfile(profile || user);

      let customCode: string | undefined;
      let settings: RoomSettings;

      if (typeof settingsOrCode === 'string') {
        customCode = settingsOrCode.trim();
        settings = possibleSettings || {
          timeControlId: 'rapid',
          timeControlName: 'Rapid 10+0',
          initialSeconds: 600,
          incrementSeconds: 0,
          color: 'white',
          rated: true,
        };
      } else if (settingsOrCode && typeof settingsOrCode === 'object') {
        settings = settingsOrCode;
        if (typeof possibleSettings === 'string') {
          customCode = (possibleSettings as string).trim();
        }
      } else {
        settings = {
          timeControlId: 'rapid',
          timeControlName: 'Rapid 10+0',
          initialSeconds: 600,
          incrementSeconds: 0,
          color: 'white',
          rated: true,
        };
      }

      const creatorColor = settings.color;
      const opponentColor =
        creatorColor === 'white' ? 'black' : creatorColor === 'black' ? 'white' : 'black';
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

      // Uppercase alphanumeric character set for generating clean 6-character codes
      const UPPERCASE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const generate6CharRoomCode = (): string => {
        let code = '';
        for (let i = 0; i < 6; i++) {
          const idx = Math.floor(Math.random() * UPPERCASE_CHARS.length);
          code += UPPERCASE_CHARS[idx];
        }
        return code.toUpperCase();
      };

      const MAX_ATTEMPTS = 5;
      let confirmedRoomCode = '';

      // Execute a Firestore transaction to claim a unique, uppercase, 6-character room code and store 'waiting' status
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let candidateCode: string;
        if (attempt === 1 && customCode && customCode.length === 6) {
          candidateCode = customCode.toUpperCase();
        } else {
          candidateCode = generate6CharRoomCode();
        }

        const candidateRef = doc(db, 'rooms', candidateCode);

        try {
          await runTransaction(db, async (transaction) => {
            // 1. Transaction Read: verify uniqueness
            const existingSnap = await transaction.get(candidateRef);
            if (existingSnap.exists()) {
              const existingData = existingSnap.data();
              const isStillActive =
                existingData?.status === 'waiting' ||
                existingData?.status === 'ready' ||
                existingData?.status === 'in_progress';

              const isExpired = existingData?.expiresAt?.toDate
                ? existingData.expiresAt.toDate().getTime() < Date.now()
                : false;

              // If active room owned by someone else, treat as collision
              if (isStillActive && !isExpired && existingData?.creatorId !== activeProfile.uid) {
                throw new Error('COLLISION');
              }
            }

            // 2. Transaction Write: store room document with 'waiting' status
            transaction.set(candidateRef, {
              roomId: candidateCode,
              roomCode: candidateCode,
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
              gameId: null,
              createdAt: serverTimestamp(),
              expiresAt: Timestamp.fromDate(expiresAt),
            });
          });

          confirmedRoomCode = candidateCode;
          break; // Successfully claimed code and stored waiting room via transaction!
        } catch (err: any) {
          if (err?.message === 'COLLISION') {
            if (attempt < MAX_ATTEMPTS) {
              console.warn(
                `[RoomContext] Room code collision on "${candidateCode}". Retrying with a new 6-char code (attempt ${attempt + 1}/${MAX_ATTEMPTS})...`
              );
              continue;
            }
            throw new Error('Could not reserve a unique room code. Please try again.');
          }
          throw err;
        }
      }

      if (!confirmedRoomCode) {
        throw new Error('Failed to generate or confirm room code.');
      }

      // 3. Confirm document existence on the server before updating state and navigating
      const confirmedDocRef = doc(db, 'rooms', confirmedRoomCode);
      const serverSnap = await getDoc(confirmedDocRef);

      if (!serverSnap.exists()) {
        throw new Error(
          `Server failed to confirm existence of room document for code ${confirmedRoomCode}`
        );
      }

      const serverData = serverSnap.data();
      if (!serverData || serverData.status !== 'waiting') {
        throw new Error(
          `Room document verification failed: expected status 'waiting', received '${serverData?.status}'`
        );
      }

      const verifiedRoom: PrivateRoom = {
        roomId: confirmedRoomCode,
        roomCode: confirmedRoomCode,
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
        gameId: null,
      };

      // 4. Update state and navigate ONLY after the server confirms document existence
      setCurrentRoom(verifiedRoom);
      setJoinError(null);
      soundManager.playNotification();

      // Dispatch navigation event so view transitions to the WaitingRoom
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('navigate-to-room', {
            detail: { roomCode: confirmedRoomCode },
          })
        );
      }

      // 5. Background non-blocking persistence & subcollection tasks
      try {
        localStorage.setItem(`chess_room_${confirmedRoomCode}`, JSON.stringify(verifiedRoom));
        recordLocalUserCreatedRoom({
          code: confirmedRoomCode,
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
            customCode: confirmedRoomCode,
            timeControl: {
              initialSeconds: settings.initialSeconds,
              incrementSeconds: settings.incrementSeconds,
            },
            side: settings.color,
            playerInfo: {
              uid: activeProfile.uid,
              name: activeProfile.displayName || 'Host',
              elo: activeProfile.elo || 1200,
            },
          }),
        }).catch(() => {});
      } catch {}

      try {
        const msgColl = collection(db, 'rooms', confirmedRoomCode, 'messages');
        safeAddDoc(msgColl, {
          userId: 'system',
          userName: 'System',
          message: `Battle room created! Code: ${confirmedRoomCode}. Waiting for challenger.`,
          timestamp: serverTimestamp(),
          isSystem: true,
          type: 'system',
        }).catch(() => {});
      } catch (err) {
        console.warn('Could not write initial room message to subcollection:', err);
      }

      return verifiedRoom;
    },
    [profile, user]
  );

  const createRoom = createPrivateRoom;

  const joinRoomWithContext = useCallback(
    async (inviteOrCode: string | UserInvite | any): Promise<PrivateRoom> => {
      const activeProfile = getHydratedProfile(profile || user);
      let rawCode = '';
      let targetInvite: any = null;

      if (typeof inviteOrCode === 'string') {
        rawCode = inviteOrCode;
      } else if (inviteOrCode && typeof inviteOrCode === 'object') {
        rawCode = inviteOrCode.roomCode || inviteOrCode.roomId || inviteOrCode.code || '';
        targetInvite = inviteOrCode;
      }

      const cleanCode = normalizeRoomCode(rawCode);
      if (!cleanCode) {
        throw new Error('No room code provided. Please enter a valid room code.');
      }

      const matchedInvite =
        targetInvite ||
        incomingInvites.find(
          (i) =>
            normalizeRoomCode(i.roomCode) === cleanCode ||
            normalizeRoomCode(i.roomId) === cleanCode
        );

      // Phase 1: 6-Tier Room Resolution Engine
      // (1) Direct Doc -> (2) Indexed Query -> (3) Local Cache -> (4) online_matches check -> (5) Server REST -> (6) Fallback Synthesis
      const resolved = await resolveRoom(cleanCode, activeProfile, matchedInvite);

      if (!resolved || !resolved.room) {
        throw new Error('No room found with that code. Please check and try again.');
      }

      const roomData = resolved.room;

      // Direct Routing & Status Logic: NO PREMATURE NAVIGATION!
      // Only navigate if an existing, verified gameId is already present on the room document
      if (
        (resolved.alreadyStarted || roomData.status === 'in_progress') &&
        (resolved.gameId || roomData.gameId)
      ) {
        const targetGame = resolved.gameId || roomData.gameId;
        if (targetGame) {
          setActiveGameId(targetGame);
          setCurrentRoom(roomData);
          soundManager.playMatchFound();
          return roomData;
        }
      }

      const opponentName = activeProfile.displayName || 'Opponent';
      const opponentPhotoURL = activeProfile.photoURL || null;
      const opponentElo = typeof activeProfile.elo === 'number' ? activeProfile.elo : 1200;

      // Phase 1: Atomic Handshake Transaction via Firestore runTransaction
      // Atomically verify that the room exists, prevent race conditions (duplicate opponent claims),
      // update opponentId, and set status to 'ready' during handshake.
      const targetDocId = resolved.room.roomId || cleanCode;
      const roomDoc = doc(db, 'rooms', targetDocId);
      let claimedRoom: PrivateRoom | null = null;
      let lastTxError: any = null;

      const atomicUpdatePayload: Record<string, any> = {
        opponentId: activeProfile.uid,
        opponentName,
        opponentPhotoURL: opponentPhotoURL || null,
        opponentElo,
        status: 'ready',
        updatedAt: serverTimestamp(),
      };

      const isVersionOrContentionError = (err: any) => {
        const msg = (err?.message || '').toLowerCase();
        return (
          msg.includes('stored version') ||
          msg.includes('base version') ||
          err?.code === 'aborted' ||
          err?.code === 'failed-precondition' ||
          msg.includes('contention')
        );
      };

      // Attempt handshake transaction with retries on optimistic concurrency version conflicts
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          claimedRoom = await runTransaction(db, async (transaction) => {
            const roomSnap = await transaction.get(roomDoc);

            if (!roomSnap.exists()) {
              if (resolved.room) {
                // Room was discovered via Tier 3, 4, 5, or 6
                const newRoomPayload: any = {
                  ...resolved.room,
                  roomId: cleanCode,
                  roomCode: cleanCode,
                  opponentId: activeProfile.uid,
                  opponentName,
                  opponentPhotoURL: opponentPhotoURL || null,
                  opponentElo,
                  status: 'ready',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                };
                transaction.set(roomDoc, newRoomPayload);
                return {
                  ...resolved.room,
                  ...newRoomPayload,
                  roomCode: cleanCode,
                };
              }
              throw new Error(`Room "${cleanCode}" not found. Please verify the code and try again.`);
            }

            const currentRoomData = roomSnap.data() as PrivateRoom;

            // Check if already claimed by this user (e.g. from previous attempt or concurrent accept)
            if (currentRoomData.opponentId === activeProfile.uid) {
              return {
                ...currentRoomData,
                roomCode: cleanCode,
              };
            }

            // Prevent race condition: check if another challenger already claimed this room
            if (
              currentRoomData.opponentId &&
              currentRoomData.opponentId !== activeProfile.uid
            ) {
              throw new Error('This room is already full. Another player has joined.');
            }

            // Prevent joining an expired or ended room
            if (currentRoomData.status === 'ended' || currentRoomData.status === 'expired') {
              throw new Error('This room has ended or expired.');
            }

            // If game is already in progress with another player
            if (
              currentRoomData.status === 'in_progress' &&
              currentRoomData.opponentId !== activeProfile.uid
            ) {
              throw new Error('This game is already in progress.');
            }

            transaction.update(roomDoc, atomicUpdatePayload);

            return {
              ...currentRoomData,
              ...atomicUpdatePayload,
              roomCode: cleanCode,
            };
          });

          // Handshake transaction succeeded
          break;
        } catch (txErr: any) {
          lastTxError = txErr;
          if (isVersionOrContentionError(txErr)) {
            console.warn(`[RoomContext] Handshake version contention on attempt ${attempt + 1}, retrying...`);
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
              continue;
            }
          } else {
            // Fatal business logic error, break out immediately
            break;
          }
        }
      }

      // If transaction failed due to version contention after retries, try direct read & safeUpdateDoc fallback
      if (!claimedRoom) {
        if (isVersionOrContentionError(lastTxError)) {
          try {
            console.warn('[RoomContext] Handshake version contention detected; executing fallback verification...');
            const fallbackSnap = await getDoc(roomDoc);
            if (fallbackSnap.exists()) {
              const currentRoomData = fallbackSnap.data() as PrivateRoom;
              if (currentRoomData.opponentId === activeProfile.uid) {
                claimedRoom = {
                  ...currentRoomData,
                  roomCode: cleanCode,
                };
              } else if (!currentRoomData.opponentId) {
                await safeUpdateDoc(roomDoc, atomicUpdatePayload);
                claimedRoom = {
                  ...currentRoomData,
                  ...atomicUpdatePayload,
                  roomCode: cleanCode,
                };
              } else {
                throw new Error('This room is already full. Another player has joined.');
              }
            } else if (resolved.room) {
              const newRoomPayload: any = {
                ...resolved.room,
                roomId: cleanCode,
                roomCode: cleanCode,
                opponentId: activeProfile.uid,
                opponentName,
                opponentPhotoURL: opponentPhotoURL || null,
                opponentElo,
                status: 'ready',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };
              await safeSetDoc(roomDoc, newRoomPayload);
              claimedRoom = {
                ...resolved.room,
                ...newRoomPayload,
                roomCode: cleanCode,
              };
            }
          } catch (fallbackErr: any) {
            console.warn('[RoomContext] Handshake contention fallback error:', fallbackErr);
          }
        }

        if (!claimedRoom) {
          if (
            lastTxError?.code === 'permission-denied' ||
            lastTxError?.message?.includes('Missing or insufficient permissions')
          ) {
            handleFirestoreError(lastTxError, OperationType.UPDATE, `rooms/${cleanCode}`);
          }
          console.error('[RoomContext] Handshake transaction failed:', lastTxError?.message || lastTxError);
          setJoinError(lastTxError?.message || 'Failed to join room.');
          throw lastTxError;
        }
      }

      // Sync into server REST endpoints
      try {
        fetch(`/api/rooms/join/${encodeURIComponent(cleanCode)}`, {
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
      }).catch(() => {});

      const joinedRoom: PrivateRoom = {
        ...claimedRoom,
        roomCode: cleanCode,
        opponentId: activeProfile.uid,
        opponentName,
        opponentPhotoURL: opponentPhotoURL || undefined,
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

      // If gameId already exists from creator, set it only if verified
      if (joinedRoom.gameId) {
        verifyOnlineMatchExists(joinedRoom.gameId).then((valid) => {
          if (valid) {
            setActiveGameId(joinedRoom.gameId);
          }
        });
      } else {
        // Both players are in the waiting room; trigger countdown
        startCountdownFlow(joinedRoom);
      }

      return joinedRoom;
    },
    [profile, user, incomingInvites, startCountdownFlow]
  );

  const joinRoom = useCallback(
    async (code: string, inviteFallback?: Partial<UserInvite>): Promise<PrivateRoom> => {
      return joinRoomWithContext({
        roomCode: code,
        ...(inviteFallback || {}),
      });
    },
    [joinRoomWithContext]
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
        (inv) =>
          inv.id === inviteId ||
          normalizeRoomCode(inv.roomCode) === normalizeRoomCode(roomCode) ||
          normalizeRoomCode(inv.roomId) === normalizeRoomCode(roomCode)
      );
      const cleanCode = normalizeRoomCode(
        roomCode || targetInvite?.roomCode || targetInvite?.roomId || currentRoom?.roomCode
      );
      if (!cleanCode) {
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
          const roomInviteRef = doc(db, 'rooms', cleanCode, 'invites', inviteId);
          await safeUpdateDoc(roomInviteRef, { status: 'accepted' });
        } catch {}

        // Join room as opponent, passing fallback targetInvite
        await joinRoom(cleanCode, targetInvite);
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
        createPrivateRoom,
        createRoom,
        joinRoom,
        joinRoomWithContext,
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

export default RoomProvider;
