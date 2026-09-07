import { io, Socket } from 'socket.io-client';

export interface PendingChallenge {
  id: string; // matchId or inviteId
  challengerId: string;
  challengerName: string;
  challengerAvatar?: string;
  targetUserId?: string;
  targetUserName?: string;
  timeControlName?: string;
  timeControlSeconds?: number;
  createdAt: number; // timestamp in milliseconds
  expiresAt: number; // timestamp in milliseconds (defaults to createdAt + 30000)
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  roomCode?: string;
  matchId?: string;
  type?: 'direct' | 'room' | 'lobby' | 'notification';
}

class SocketService {
  private socket: Socket | null = null;
  private uid: string | null = null;
  private pendingChallenges: Map<string, PendingChallenge> = new Map();
  private reconciliationTimer: any = null;
  private reconcileListeners: Set<(reconciled: PendingChallenge[], reason: string) => void> = new Set();
  
  public connect(uid?: string, token?: string) {
    if (uid) this.uid = uid;
    let authToken = token; try { authToken = authToken || localStorage.getItem('token') || localStorage.getItem('chess_jwt') || undefined; } catch (e) {}
    
    if (!this.socket) {
      // Connect to the same origin that serves this page so the browser can reach
      // the server's Socket.IO endpoint (http://host:port/socket.io/).
      const origin = typeof window !== 'undefined' && window.location.origin;
      this.socket = io(origin, {
        auth: { token: authToken, uid: this.uid },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        transports: ['polling', 'websocket'],
      });
      
      this.socket.on('connect', () => {
        console.log('[Matchmaking] Connected to Real-time Engine:', this.socket?.id);
      });

      this.socket.on('reconnect_success', (data) => {
        console.log('[Reconnection] Authoritative state restored for match:', data.matchId);
      });

      // Handle server-side game expiration & cancellation
      this.socket.on('gameExpired', (data: any) => {
        const id = data?.gameId || data?.matchId;
        if (id) {
          this.updateChallengeStatus(id, 'expired');
        }
      });

      this.socket.on('gameCancelled', (data: any) => {
        const id = data?.gameId || data?.matchId;
        if (id) {
          this.updateChallengeStatus(id, 'cancelled');
        }
      });
    }

    // Ensure state reconciliation watchdog is running
    this.startReconciliationLoop();

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public setUid(uid: string) {
    this.uid = uid;
  }

  // ---- Pending Challenges & State Reconciliation Logic ----

  /**
   * Registers a challenge in the pending state.
   * Auto-sets the 30-second expiration timestamp if not already defined.
   */
  public registerPendingChallenge(
    challenge: Omit<PendingChallenge, 'createdAt' | 'expiresAt' | 'status'> & {
      createdAt?: number;
      expiresAt?: number;
      status?: PendingChallenge['status'];
    }
  ): PendingChallenge {
    const now = Date.now();
    const createdAt = challenge.createdAt || now;
    const expiresAt = challenge.expiresAt || (createdAt + 30000); // Strict 30-second TTL
    const fullChallenge: PendingChallenge = {
      ...challenge,
      createdAt,
      expiresAt,
      status: challenge.status || 'pending',
    };

    this.pendingChallenges.set(fullChallenge.id, fullChallenge);
    this.startReconciliationLoop();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('challenge_registered', { detail: fullChallenge })
      );
    }

    return fullChallenge;
  }

  /**
   * Updates a challenge's status (accepted, declined, expired, cancelled)
   * and dispatches a reconciliation event to keep all UI listeners in sync.
   */
  public updateChallengeStatus(id: string, status: PendingChallenge['status']): void {
    const existing = this.pendingChallenges.get(id);
    if (existing) {
      existing.status = status;
      this.pendingChallenges.set(id, existing);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('challenge_reconciled', {
          detail: { challengeId: id, status },
        })
      );
    }
  }

  /**
   * Returns all challenges currently in 'pending' state.
   */
  public getPendingChallenges(): PendingChallenge[] {
    return Array.from(this.pendingChallenges.values()).filter(
      (c) => c.status === 'pending'
    );
  }

  /**
   * Returns a specific challenge by ID.
   */
  public getChallenge(id: string): PendingChallenge | undefined {
    return this.pendingChallenges.get(id);
  }

  /**
   * Cancels a pending challenge and notifies the server.
   */
  public cancelChallenge(id: string, reason = 'cancelled_by_user'): void {
    const challenge = this.pendingChallenges.get(id);
    if (challenge && challenge.status === 'pending') {
      challenge.status = 'cancelled';
      this.pendingChallenges.set(id, challenge);
    }

    if (this.socket) {
      this.socket.emit('cancelWaiting', { matchId: id, gameId: id, reason });
      this.socket.emit('cancel_challenge', { challengeId: id, matchId: id, reason });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('challenge_reconciled', {
          detail: { challengeId: id, status: 'cancelled', reason },
        })
      );
    }
  }

  /**
   * Performs an immediate state reconciliation check across all pending challenges.
   * If any challenge has remained in 'pending' for >= 30 seconds, it is marked as 'expired',
   * cleanup is triggered on the server, and a force-update event is dispatched to the client.
   */
  public reconcileNow(): PendingChallenge[] {
    const now = Date.now();
    const expiredList: PendingChallenge[] = [];

    for (const [id, challenge] of this.pendingChallenges.entries()) {
      if (challenge.status === 'pending') {
        const isPastExpiry = now >= challenge.expiresAt;
        const isOlderThan30Seconds = (now - challenge.createdAt) >= 30000;

        if (isPastExpiry || isOlderThan30Seconds) {
          challenge.status = 'expired';
          this.pendingChallenges.set(id, challenge);
          expiredList.push(challenge);

          // Tell the server matchmaking engine to clean up waiting state
          if (this.socket) {
            this.socket.emit('cancelWaiting', {
              matchId: id,
              gameId: id,
              gameCode: challenge.roomCode,
              reason: '30s_timeout',
            });
            this.socket.emit('challenge_timeout', {
              challengeId: id,
              matchId: id,
              reason: '30s_timeout',
            });
          }

          // Broadcast locally to client components
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('challenge_timeout', {
                detail: { challenge, reason: '30s_timeout' },
              })
            );
            window.dispatchEvent(
              new CustomEvent('challenge_reconciled', {
                detail: { challengeId: id, status: 'expired', reason: '30s_timeout' },
              })
            );
          }
        }
      }
    }

    if (expiredList.length > 0) {
      this.reconcileListeners.forEach((listener) => {
        try {
          listener(expiredList, '30s_timeout');
        } catch (e) {
          console.warn('[SocketService] Error in reconciliation listener:', e);
        }
      });
    }

    return expiredList;
  }

  /**
   * Starts the automatic reconciliation watchdog timer (runs every 2 seconds).
   */
  public startReconciliationLoop(intervalMs = 2000): void {
    if (this.reconciliationTimer) return;
    this.reconciliationTimer = setInterval(() => {
      this.reconcileNow();
    }, intervalMs);
  }

  /**
   * Stops the reconciliation watchdog timer.
   */
  public stopReconciliationLoop(): void {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }
  }

  /**
   * Subscribes to reconciliation cleanup events.
   */
  public onReconcile(
    callback: (reconciled: PendingChallenge[], reason: string) => void
  ): () => void {
    this.reconcileListeners.add(callback);
    return () => {
      this.reconcileListeners.delete(callback);
    };
  }

  // ---- Queue / Room Matchmaking ----

  public joinQueue(params: {
    uid: string;
    rating: number;
    rd?: number;
    pool: string;
    rated: boolean;
    recentColors?: ('w' | 'b')[];
  }) {
    if (!this.socket) this.connect();
    // Simulate ping calculation for matchmaking
    const pingStart = Date.now();
    this.socket?.emit('ping', () => {
      const ping = Date.now() - pingStart;
      this.socket?.emit('join_queue', {
        ...params,
        ping
      });
    });
  }

  public leaveQueue(uid: string) {
    this.socket?.emit('leave_queue', { uid });
  }

  public emitTabBlur(matchId: string, uid: string) {
    this.socket?.emit('tab_blur', { matchId, uid });
  }

  public disconnect() {
    this.stopReconciliationLoop();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
