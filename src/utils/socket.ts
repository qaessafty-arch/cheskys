import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private uid: string | null = null;
  
  public connect(uid?: string, token?: string) {
    if (uid) this.uid = uid;
    let authToken = token;
    try {
      authToken = authToken || localStorage.getItem('token') || localStorage.getItem('chess_jwt') || undefined;
    } catch (e) {}
    
    if (!this.socket) {
      // Connect to the same origin that serves this page so the browser can reach
      // the server's Socket.IO endpoint (http://host:port/socket.io/).
      const origin = typeof window !== 'undefined' && window.location.origin;
      this.socket = io(origin || undefined, {
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

      this.socket.on('disconnect', (reason) => {
        console.warn('[Matchmaking] Disconnected from Real-time Engine:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.warn('[Matchmaking] Connection error:', error.message);
      });

      this.socket.on('reconnect_success', (data) => {
        console.log('[Reconnection] Authoritative state restored for match:', data.matchId);
      });
    }
    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public setUid(uid: string) {
    this.uid = uid;
  }

  public joinQueue(params: {
    uid: string;
    rating: number;
    rd?: number;
    pool: string;
    rated: boolean;
    recentColors?: ('w' | 'b')[];
  }) {
    if (!this.socket) this.connect();
    this.socket?.emit('join_queue', {
      ...params,
      ping: 35
    });
  }

  public leaveQueue(uid: string) {
    this.socket?.emit('leave_queue', { uid });
  }

  public emitTabBlur(matchId: string, uid: string) {
    this.socket?.emit('tab_blur', { matchId, uid });
  }

  public createRoom(params: {
    timeControl?: any;
    side?: 'w' | 'b' | 'random';
    playerInfo?: any;
    customCode?: string;
  }): Promise<{ gameCode: string; gameId: string; roomCode?: string; roomId?: string }> {
    const s = this.connect();
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          // Fallback to REST API if socket response takes longer than 2.5s
          fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.error) reject(new Error(data.error));
              else resolve(data);
            })
            .catch((err) => reject(err));
        }
      }, 2500);

      s.emit('createRoom', params, (res: any) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        if (res?.error) reject(new Error(res.error));
        else resolve(res);
      });
    });
  }

  public joinRoom(
    code: string,
    playerInfo?: any,
  ): Promise<{ color: 'w' | 'b'; gameId: string; gameCode: string }> {
    const s = this.connect();
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerInfo }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.error) reject(new Error(data.error));
              else resolve(data);
            })
            .catch((err) => reject(err));
        }
      }, 2500);

      s.emit('joinRoom', { roomCode: code, gameCode: code, playerInfo }, (res: any) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        if (res?.error) reject(new Error(res.error));
        else resolve(res);
      });
    });
  }

  public cancelRoom(codeOrId: string): Promise<boolean> {
    const s = this.connect();
    return new Promise((resolve) => {
      s.emit('cancelRoom', { roomCode: codeOrId, gameCode: codeOrId }, () => {
        resolve(true);
      });
      fetch(`/api/rooms/${encodeURIComponent(codeOrId)}/cancel`, {
        method: 'POST',
      }).catch(() => {});
      setTimeout(() => resolve(true), 1500);
    });
  }

  public async getMyRooms(uid?: string): Promise<any[]> {
    const queryUid = uid || this.uid || '';
    try {
      const res = await fetch(`/api/rooms/my?uid=${encodeURIComponent(queryUid)}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.rooms) ? data.rooms : [];
      }
    } catch {}

    const s = this.connect();
    return new Promise((resolve) => {
      s.emit('getMyRooms', { uid: queryUid }, (rooms: any[]) => {
        resolve(Array.isArray(rooms) ? rooms : []);
      });
      setTimeout(() => resolve([]), 1500);
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
