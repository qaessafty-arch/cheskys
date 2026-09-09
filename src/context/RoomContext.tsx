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

export type RoomStatus = 'waiting' | 'ready' | 'in_progress' | 'completed' | 'aborted' | 'ended' | 'expired';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface RoomSettings {
  timeControlId: string;
  timeControlName: string;
  initialSeconds: number;
  incrementSeconds: number;
  color: 'white' | 'black' | 'random';
  rated: boolean;
}

export interface PrivateRoom {
  roomId: string;
  roomCode: string;
  creatorId: string;
  creatorName: string;
  creatorPhotoURL?: string;
  creatorElo: number;
  creatorColor?: string;
  opponentId?: string;
  opponentName?: string;
  opponentPhotoURL?: string;
  opponentElo?: number;
  opponentColor?: 'white' | 'black' | 'random';
  status: RoomStatus;
  settings: RoomSettings;
  gameId?: string;
  createdAt: any;
  updatedAt?: any;
  chat?: RoomChatMessage[];
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  userName: string;
  userId: string;
  userPhotoURL?: string;
  message: string;
  timestamp: any;
  isSystem: boolean;
}

export interface RoomInvite {
  id: string;
  roomCode: string;
  inviterId: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined';
  invitedAt: any;
}

export interface UserInvite {
  id: string;
  userId: string;
  roomCode: string;
  roomId: string;
  invitedBy: string;
  invitedByName: string;
  invitedByPhoto?: string;
  settings?: RoomSettings;
  createdAt: any;
}

interface RoomContextType {
  connectionStatus: ConnectionStatus;
  currentRoom: PrivateRoom | null;
  incomingInvites: UserInvite[];
  loading: boolean;
  joinError: string | null;
  countdown: number | null;
  activeGameId: string | null;
  setCurrentRoom: React.Dispatch<React.SetStateAction<PrivateRoom | null>>;
  setJoinError: React.Dispatch<React.SetStateAction<string | null>>;
  createPrivateRoom: (settings: RoomSettings, customCode?: string) => Promise<string>;
  joinRoom: (inviteOrCode: any) => Promise<PrivateRoom>;
  joinRoomWithContext: (inviteOrCode: any) => Promise<PrivateRoom>;
  cancelRoom: (roomCode: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  updateRoomStatus: (roomCode: string, status: RoomStatus) => Promise<void>;
  addOpponent: (roomCode: string, opponent: any) => Promise<void>;
  inviteFriend: (roomCode: string, friendUid: string) => Promise<void>;
  acceptInvite: (inviteId: string, roomCode: string) => Promise<void>;
  declineInvite: (inviteId: string, roomCode: string) => Promise<void>;
  sendChatMessage: (roomCode: string, message: string) => Promise<void>;
  markRoomExpiredIfDue: () => void;
  dismissActiveGame: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [currentRoom, setCurrentRoom] = useState<PrivateRoom | null>(null);
  const [incomingInvites, setIncomingInvites] = useState<UserInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoomRef = useRef<PrivateRoom | null>(null);
  const launchedRoomRef = useRef<string | null>(null);
  const cleanedUpRoomsRef = useRef(new Set<string>());

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // Real-time listener for current room
  useEffect(() => {
    if (!currentRoom?.roomCode) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    const roomRef = doc(db, 'rooms', currentRoom.roomCode);
    const unsub = onSnapshot(roomRef, { includeMetadataChanges: true }, (docSnap) => {
      if (!docSnap.metadata.fromCache) setConnectionStatus('connected');

      if (!docSnap.exists()) {
        if (currentRoomRef.current?.status === 'waiting') {
          setCurrentRoom(null);
        }
        return;
      }

      const data = docSnap.data() as PrivateRoom;
      setCurrentRoom(data);

      if (data.status === 'ready' && launchedRoomRef.current !== data.roomCode) {
        if (!countdownTimerRef.current) {
          startCountdownFlow(data);
        }
      }

      if (data.status === 'in_progress' && data.gameId) {
        const activeProf = getHydratedProfile(profile, user);
        if (activeProf.uid !== data.creatorId) {
          verifyOnlineMatchExists(data.gameId).then((exists) => {
            if (exists) setActiveGameId(data.gameId);
          });
        } else {
          setActiveGameId(data.gameId);
        }
      }
    });

    return () => {
      unsub();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [currentRoom?.roomCode, profile, user]);

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
        clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        setCountdown(null);
        soundManager.playCountdownTick(true);

        const activeProfile = getHydratedProfile(profile, user);

        if (activeProfile.uid === room.creatorId && launchedRoomRef.current !== cleanCode) {
          launchedRoomRef.current = cleanCode;
          try {
            const gameSessionId = await createOnlineMatch(
              { uid: room.creatorId, displayName: room.creatorName, elo: room.creatorElo },
              {
                id: room.settings.timeControlId,
                name: room.settings.timeControlName,
                initialSeconds: room.settings.initialSeconds,
                incrementSeconds: room.settings.incrementSeconds,
                category: room.settings.initialSeconds < 180 ? 'bullet' : room.settings.initialSeconds < 600 ? 'blitz' : 'rapid'
              },
              room.settings.color,
              cleanCode,
              { uid: room.opponentId || '', displayName: room.opponentName || 'Challenger', elo: room.opponentElo || 1200 }
            );

            await safeUpdateDoc(doc(db, 'rooms', cleanCode), {
              status: 'in_progress',
              gameId: gameSessionId,
              startedAt: serverTimestamp(),
            });

            setActiveGameId(gameSessionId);
          } catch (err) {
            console.error('Match launch failed', err);
          }
        }
      }
    }, 1000);
  };

  const joinRoomWithContext = useCallback(
    async (inviteOrCode: any) => {
      const activeProfile = getHydratedProfile(profile, user);
      let rawCode = typeof inviteOrCode === 'string' ? inviteOrCode : (inviteOrCode?.roomCode || inviteOrCode?.roomId);
      const cleanCode = normalizeRoomCode(rawCode);
      if (!cleanCode) throw new Error('No room code provided.');

      const resolved = await resolveRoom(cleanCode, activeProfile, inviteOrCode);
      if (!resolved) throw new Error('No room found with that code.');

      const { room, synthesize } = resolved;

      if (room.status === 'in_progress' && room.gameId) {
        setActiveGameId(room.gameId);
        setCurrentRoom(room);
        return room;
      }

      try {
        const claimedRoom = await runTransaction(db, async (transaction) => {
          const roomRef = doc(db, 'rooms', cleanCode);
          const snap = await transaction.get(roomRef);

          if (!snap.exists() && synthesize) {
            const newRoom: PrivateRoom = {
              ...room,
              roomId: cleanCode,
              roomCode: cleanCode,
              opponentId: activeProfile.uid,
              status: 'ready',
              createdAt: serverTimestamp()
            };
            transaction.set(roomRef, newRoom);
            return newRoom;
          }

          const data = snap.data() as PrivateRoom;
          if (data.opponentId && data.opponentId !== activeProfile.uid) throw new Error('Room is full.');

          const updated = { ...data, opponentId: activeProfile.uid, opponentName: activeProfile.displayName, status: 'ready' as RoomStatus };
          transaction.update(roomRef, updated);
          return updated as PrivateRoom;
        });

        setCurrentRoom(claimedRoom);
        if (claimedRoom.status === 'ready') startCountdownFlow(claimedRoom);
        return claimedRoom;
      } catch (err: any) {
        const msg = err.message || 'Failed to join room';
        setJoinError(msg);
        toast.error(msg);
        throw err;
      }
    },
    [profile, user]
  );

  const joinRoom = joinRoomWithContext;

  const createPrivateRoom = async (settings: RoomSettings, customCode?: string) => {
    const activeProfile = getHydratedProfile(profile, user);
    const cleanCode = customCode ? normalizeRoomCode(customCode) || Math.random().toString(36).substring(2, 8).toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = doc(db, 'rooms', cleanCode);

    const newRoom: PrivateRoom = {
      roomId: cleanCode,
      roomCode: cleanCode,
      creatorId: activeProfile.uid,
      creatorName: activeProfile.displayName,
      creatorElo: activeProfile.elo,
      status: 'waiting',
      settings,
      createdAt: serverTimestamp(),
    };

    await safeSetDoc(roomRef, newRoom);
    setCurrentRoom(newRoom);
    return cleanCode;
  };

  const cancelRoom = async (roomCode: string) => {
    const cleanCode = normalizeRoomCode(roomCode);
    if (!cleanCode) return;
    await safeDeleteDoc(doc(db, 'rooms', cleanCode));
    setCurrentRoom(null);
  };

  const leaveRoom = async () => {
    if (!currentRoom) return;
    const cleanCode = normalizeRoomCode(currentRoom.roomCode);
    if (!cleanCode) return;

    const roomRef = doc(db, 'rooms', cleanCode);
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      const data = snap.data() as PrivateRoom;
      if (data.creatorId === profile?.uid) {
        await safeDeleteDoc(roomRef);
      } else {
        await safeUpdateDoc(roomRef, {
          opponentId: deleteField(),
          opponentName: deleteField(),
          status: 'waiting' as RoomStatus,
        });
      }
    }
    setCurrentRoom(null);
  };

  const updateRoomStatus = async (roomCode: string, status: RoomStatus) => {
    const cleanCode = normalizeRoomCode(roomCode);
    if (!cleanCode) return;
    await safeUpdateDoc(doc(db, 'rooms', cleanCode), { status });
  };

  const addOpponent = async (roomCode: string, opponent: any) => {
    const cleanCode = normalizeRoomCode(roomCode);
    if (!cleanCode) return;
    await safeUpdateDoc(doc(db, 'rooms', cleanCode), {
      opponentId: opponent.uid,
      opponentName: opponent.displayName,
      opponentElo: opponent.elo,
      status: 'ready' as RoomStatus,
    });
  };

  const inviteFriend = async (roomCode: string, friendUid: string) => {
    // This would typically involve sending a Firestore notification
    await safeAddDoc(collection(db, 'notifications'), {
      userId: friendUid,
      type: 'room_invite',
      title: 'Celestial Invitation',
      message: `You are invited to join a private trial in room ${roomCode}`,
      roomCode: roomCode,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  };

  const acceptInvite = useCallback(
    async (inviteId: string, roomCode: string) => {
      const targetInvite = incomingInvites.find(inv => inv.id === inviteId || normalizeRoomCode(inv.roomCode) === normalizeRoomCode(roomCode));
      try {
        await joinRoomWithContext(targetInvite || roomCode);
      } catch (err: any) {
        setJoinError(err.message);
      }
    },
    [incomingInvites, joinRoomWithContext]
  );

  const declineInvite = async (inviteId: string, roomCode: string) => {
    // Update notification status to read/declined
    await safeUpdateDoc(doc(db, 'notifications', inviteId), { isRead: true });
  };

  const sendChatMessage = async (roomCode: string, message: string) => {
    socketService.getSocket()?.emit('room_message', { roomCode, message, senderId: user?.uid });
  };

  const markRoomExpiredIfDue = () => {
    // Implementation for periodic cleanup of abandoned rooms
  };

  const dismissActiveGame = () => {
    setActiveGameId(null);
  };

  return (
    <RoomContext.Provider value={{
      connectionStatus, currentRoom, incomingInvites, loading, joinError,
      countdown, activeGameId, setCurrentRoom, setJoinError,
      createPrivateRoom, joinRoom, joinRoomWithContext,
      cancelRoom, leaveRoom, updateRoomStatus, addOpponent,
      inviteFriend, acceptInvite, declineInvite, sendChatMessage,
      markRoomExpiredIfDue, dismissActiveGame
    }}>
      {children}
    </RoomContext.Provider>
  );
};
