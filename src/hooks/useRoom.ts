import { useRoom as _useRoom, PrivateRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { normalizeRoomCode, getHydratedProfile } from '../utils/roomResolver';
import { createOnlineMatch } from '../services/matchService';
import { OnlineMatchPlayer, TimeControl } from '../types/chess';
import { doc } from 'firebase/firestore';
import { db, safeUpdateDoc } from '../utils/firebase';

export function useRoom() {
  const room = _useRoom();
  const { profile } = useAuth();
  const { showToast, sendNotification } = useNotification();

  /**
   * Navigation Safety: All navigate calls must be managed via the useRoom hook
   * to prevent double-routing or history stack pollution.
   */
  const navigateToMatch = (gameId: string) => {
    if (!gameId) return;
    window.dispatchEvent(
      new CustomEvent('navigate-to-match', {
        detail: { matchId: gameId.trim() },
      })
    );
  };

  const navigateToRoom = (roomCode?: string) => {
    const cleanCode = normalizeRoomCode(roomCode || room.currentRoom?.roomCode);
    window.dispatchEvent(
      new CustomEvent('navigate-to-room', {
        detail: { roomCode: cleanCode },
      })
    );
  };

  /**
   * Enforced Handshake Protocol Rule:
   * ONLY the room creator is permitted to provision the final 'online_match' document.
   */
  const takeOverAsHost = async (targetRoom: PrivateRoom): Promise<string | null> => {
    const activeProfile = getHydratedProfile(profile);
    const cleanCode = normalizeRoomCode(targetRoom.roomCode);

    // Strict Role Enforcement: Invitee or third party cannot provision the match document
    if (!targetRoom.creatorId || targetRoom.creatorId !== activeProfile.uid) {
      console.error(
        '[useRoom] Permission denied: Only the room creator can provision the final online_match document.'
      );
      throw new Error(
        'Handshake permission denied: Only the room creator can provision the final online_match document.'
      );
    }

    try {
      const hostPlayer: OnlineMatchPlayer = {
        uid: activeProfile.uid,
        displayName: activeProfile.displayName,
        avatar: activeProfile.photoURL,
        elo: activeProfile.elo,
      };

      const category: 'bullet' | 'blitz' | 'rapid' | 'classical' =
        targetRoom.settings.initialSeconds < 180
          ? 'bullet'
          : targetRoom.settings.initialSeconds < 600
          ? 'blitz'
          : targetRoom.settings.initialSeconds < 1800
          ? 'rapid'
          : 'classical';

      const tc: TimeControl = {
        id: targetRoom.settings.timeControlId || 'tc_custom',
        name: targetRoom.settings.timeControlName,
        initialSeconds: targetRoom.settings.initialSeconds,
        incrementSeconds: targetRoom.settings.incrementSeconds,
        category,
      };

      const opponentPlayer: OnlineMatchPlayer | null =
        targetRoom.creatorId && targetRoom.creatorId !== activeProfile.uid
          ? {
              uid: targetRoom.creatorId,
              displayName: targetRoom.creatorName,
              avatar: targetRoom.creatorPhotoURL || null,
              elo: targetRoom.creatorElo,
            }
          : null;

      const gameSessionId = await createOnlineMatch(
        hostPlayer,
        tc,
        targetRoom.settings.color,
        cleanCode,
        opponentPlayer
      );

      // Update room to in_progress with gameId
      try {
        const roomDoc = doc(db, 'rooms', cleanCode);
        await safeUpdateDoc(roomDoc, {
          status: 'in_progress',
          gameId: gameSessionId,
          creatorId: activeProfile.uid,
          creatorName: activeProfile.displayName,
        });
      } catch (rErr) {
        console.warn('[TakeOverAsHost] Room doc update notice:', rErr);
      }

      navigateToMatch(gameSessionId);
      return gameSessionId;
    } catch (err: any) {
      console.error('[TakeOverAsHost] Error during failover:', err);
      return null;
    }
  };

  const joinAsOpponent = async (code: string, inviteFallback?: any) => {
    const cleanCode = normalizeRoomCode(code);
    if (!cleanCode) {
      room.setJoinError('Please enter a valid room code.');
      return false;
    }

    try {
      const joined = await room.joinRoomWithContext(inviteFallback || cleanCode);
      showToast({
        type: 'room_join',
        title: 'Room Joined',
        message: `Connected to room ${cleanCode}. Prepare for battle.`,
        duration: 4000,
      });

      // Strict Handshake: Only navigate to match if gameId has been verified!
      if (joined.gameId && joined.status === 'in_progress') {
        navigateToMatch(joined.gameId);
      } else {
        navigateToRoom(cleanCode);
      }

      // Notify the host if possible
      if (joined.creatorId && profile) {
        void sendNotification(joined.creatorId, {
          userId: joined.creatorId,
          type: 'room_join',
          title: 'Opponent joined your room',
          message: `${profile.displayName || 'Opponent'} joined room ${cleanCode}.`,
        }).catch(() => {});
      }
      return true;
    } catch (e: any) {
      room.setJoinError(e?.message || 'Could not join the room.');
      return false;
    }
  };

  const hostRoom = async (code: string, settings: Parameters<typeof room.createRoom>[1]) => {
    const cleanCode = normalizeRoomCode(code);
    try {
      await room.createRoom(cleanCode, settings);
      showToast({
        type: 'room_join',
        title: 'Room Created',
        message: `Share code ${cleanCode} with your friend.`,
        duration: 6000,
      });
      navigateToRoom(cleanCode);
      return true;
    } catch (e: any) {
      room.setJoinError(e?.message || 'Could not create the room.');
      return false;
    }
  };

  const inviteFriendNotify = async (friendUid: string, friendName: string, roomCode: string) => {
    const cleanCode = normalizeRoomCode(roomCode);
    const activeProfile = getHydratedProfile(profile);

    await sendNotification(friendUid, {
      userId: friendUid,
      type: 'room_invite',
      title: 'Game invite',
      message: `${activeProfile.displayName} invited you to room ${cleanCode}. Accept to join.`,
      actionData: { roomCode: cleanCode },
    });
    showToast({
      type: 'room_invite',
      title: 'Invite Sent',
      message: `${friendName} was invited to room ${cleanCode}.`,
      duration: 5000,
    });
  };

  return {
    ...room,
    navigateToMatch,
    navigateToRoom,
    takeOverAsHost,
    joinAsOpponent,
    hostRoom,
    inviteFriendNotify,
  };
}

export default useRoom;

