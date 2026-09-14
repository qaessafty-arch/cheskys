import crypto from 'crypto';

const SECRET = process.env.RECONNECT_SECRET || 'chesskys-reconnect-session-secret-key-salt-2026';

export interface ReconnectTicket {
  matchId: string;
  uid: string;
  color: 'w' | 'b';
  seq: number;
  exp: number;
}

export function generateReconnectTicket(
  matchId: string,
  uid: string,
  color: 'w' | 'b',
  seq: number
): string {
  const payload: ReconnectTicket = {
    matchId,
    uid,
    color,
    seq,
    exp: Date.now() + 90_000, // 90-second ticket lifetime
  };
  const str = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SECRET).update(str).digest('hex');
  return Buffer.from(`${str}::${signature}`).toString('base64url');
}

export function verifyReconnectTicket(ticketString: string): ReconnectTicket | null {
  try {
    const raw = Buffer.from(ticketString, 'base64url').toString('utf-8');
    const [payloadStr, signature] = raw.split('::');
    if (!payloadStr || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('hex');
    if (signature !== expectedSig) return null;

    const payload: ReconnectTicket = JSON.parse(payloadStr);
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}
