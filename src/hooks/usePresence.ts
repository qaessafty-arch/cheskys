import { useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

const HEARTBEAT_MS = 60_000;

/**
 * Tells friends you are online: the profile's presence.lastSeen is refreshed every minute
 * while the app is open and visible. A player whose last check-in is older than the online
 * window (two and a half minutes) shows as offline, so closing the tab needs no cleanup.
 */
export function usePresence(uid: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!uid || !enabled) return;
    const ref = doc(db, 'users', uid);
    const write = (status: 'online' | 'offline') =>
      updateDoc(ref, { presence: { status, lastSeen: new Date().toISOString(), currentMatchId: null } }).catch(() => {});

    let timer: ReturnType<typeof setInterval> | null = null;
    const startBeat = () => {
      if (timer) return;
      write('online');
      timer = setInterval(() => write('online'), HEARTBEAT_MS);
    };
    const stopBeat = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stopBeat() : startBeat());
    const onLeave = () => write('offline');

    if (!document.hidden) startBeat();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onLeave);
    return () => {
      stopBeat();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onLeave);
    };
  }, [uid, enabled]);
}
