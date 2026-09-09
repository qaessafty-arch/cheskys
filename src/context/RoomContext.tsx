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

// ... (Keep your interfaces: RoomStatus, ConnectionStatus, RoomSettings, etc. exactly as they are) ...

export const RoomProvider = ({ children }) => {
  const { user, profile } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [activeGameId, setActiveGameId] = useState(null);

  const countdownTimerRef = useRef(null);
  const currentRoomRef = useRef(null);
  const launchedRoomRef = useRef(null);
  const cleanedUpRoomsRef = useRef(new Set());
  currentRoomRef.current = currentRoom;

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

      const data = docSnap.data();
      const prevStatus = currentRoomRef.current?.status;
      setCurrentRoom(data);

      if (data.status === 'ready' && launchedRoomRef.current !== data.roomCode) {
        // Only start countdown if we aren't already in a countdown or have already launched
        if (!countdownTimerRef.current) {
          startCountdownFlow(data);
        }
      }

      // Invitee transition: wait for gameId to be written by creator
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
  }, [currentRoom?.roomCode]);

  // THE STRICT HANDSHAKE: Only Creator provisions the match
  const startCountdownFlow = (room) => {
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

        const activeProfile = getHydratedProfile(profile, user);

        // ONLY the creator creates the online_match document
        if (activeProfile.uid === room.creatorId && launchedRoomRef.current !== cleanCode) {
          launchedRoomRef.current = cleanCode;
          try {
            const gameSessionId = await createOnlineMatch(
              { uid: room.creatorId, displayName: room.creatorName, elo: room.creatorElo },
              { id: room.settings.timeControlId, name: room.settings.timeControlName, initialSeconds: room.settings.initialSeconds, incrementSeconds: room.settings.incrementSeconds },
              room.settings.color,
              cleanCode,
              { uid: room.opponentId, displayName: room.opponentName, elo: room.opponentElo }
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
    async (inviteOrCode) => {
      const activeProfile = getHydratedProfile(profile, user);
      let rawCode = typeof inviteOrCode === 'string' ? inviteOrCode : (inviteOrCode?.roomCode || inviteOrCode?.roomId);
      const cleanCode = normalizeRoomCode(rawCode);
      if (!cleanCode) throw new Error('No room code provided.');

      // 6-Tier Resolution
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
            const newRoom = { ...room, roomId: cleanCode, roomCode: cleanCode, opponentId: activeProfile.uid, status: 'ready', createdAt: serverTimestamp() };
            transaction.set(roomRef, newRoom);
            return newRoom;
          }

          const data = snap.data();
          if (data.opponentId && data.opponentId !== activeProfile.uid) throw new Error('Room is full.');

          const updated = { ...data, opponentId: activeProfile.uid, opponentName: activeProfile.displayName, status: 'ready' };
          transaction.update(roomRef, updated);
          return updated;
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

  // ... (Keep existing createPrivateRoom, cancelRoom, leaveRoom, etc. logic) ...
  // Update acceptInvite to use the new context function:
  const acceptInvite = useCallback(
    async (inviteId, roomCode) => {
      const targetInvite = incomingInvites.find(inv => inv.id === inviteId || normalizeRoomCode(inv.roomCode) === normalizeRoomCode(roomCode));
      try {
        await joinRoomWithContext(targetInvite || roomCode);
      } catch (err) {
        setJoinError(err.message);
      }
    },
    [incomingInvites, joinRoomWithContext]
  );

  return (
    <RoomContext.Provider value={{ 
      connectionStatus, currentRoom, incomingInvites, loading, joinError, 
      countdown, activeGameId, setCurrentRoom, setJoinError, 
      createPrivateRoom, joinRoom: joinRoomWithContext, joinRoomWithContext, 
      cancelRoom, leaveRoom, updateRoomStatus, addOpponent, 
      inviteFriend, acceptInvite, declineInvite, sendChatMessage, 
      markRoomExpiredIfDue, dismissActiveGame 
    }}>
      {children}
    </RoomContext.Provider>
  );
};
