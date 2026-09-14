import { z } from 'zod';

export const MovePayloadSchema = z.object({
  gameId: z.string().min(3).max(64).optional(),
  matchId: z.string().min(3).max(64).optional(),
  from: z.string().regex(/^[a-h][1-8]$/, 'Invalid coordinate from'),
  to: z.string().regex(/^[a-h][1-8]$/, 'Invalid coordinate to'),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
  promotionPiece: z.enum(['q', 'r', 'b', 'n']).optional(),
  clientTimestamp: z.number().int().positive().optional(),
  seq: z.number().int().nonnegative().optional(),
  uid: z.string().optional(),
  fen: z.string().optional(),
}).refine(data => data.matchId || data.gameId, {
  message: 'Either matchId or gameId must be provided',
});

export type ValidatedMovePayload = z.infer<typeof MovePayloadSchema>;
