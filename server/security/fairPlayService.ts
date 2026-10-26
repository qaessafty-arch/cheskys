// Server side of fair play: queues finished rated games for analysis on a
// worker thread, keeps each player's history, and records the verdicts.
// It never bans or restricts anyone; 'review' entries are for a person.

import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import {
  assessSide, escalateWithHistory, type AnalysedMove, type Assessment, type GameAnalysis, type SideStats, type Verdict
} from './fairPlay';
import type { MatchSession } from '../matchmaking/types';

export interface FairPlayRecord {
  type: 'game';
  at: number;
  matchId: string;
  uid: string;
  color: 'w' | 'b';
  rating: number;
  stats: SideStats;
  verdict: Verdict;
  engineScore: number;
  reasons: string[];
}

export interface ClientSignalRecord {
  type: 'client_signal';
  at: number;
  uid: string | null;
  reason: string;
}

type LogRecord = FairPlayRecord | ClientSignalRecord;

const MIN_PLIES = 30;
const JOB_TIMEOUT_MS = 180_000;
const MAX_HISTORY_PER_PLAYER = 50;
const CLIENT_REASONS = new Set(['FREQUENT_BLUR', 'BOT_TIMING']);

export class FairPlayService {
  private history = new Map<string, FairPlayRecord[]>();
  private queue: { matchId: string; moves: AnalysedMove[]; match: MatchSession }[] = [];
  private busy = false;
  private worker: Worker | null = null;
  private nextJobId = 1;
  private readonly logFile: string;

  constructor(dir = process.env.FAIRPLAY_DIR || path.join(process.cwd(), 'data')) {
    this.logFile = path.join(dir, 'fairplay.jsonl');
    this.load();
  }

  /** Queue a finished game. Safe to call from game-over handling; never throws. */
  submit(match: MatchSession): void {
    try {
      if (!match.rated || !match.whiteUid || !match.blackUid) return;
      const verbose = match.chess.history({ verbose: true });
      if (verbose.length < MIN_PLIES) return;
      const moves: AnalysedMove[] = verbose.map((m, i) => ({
        uci: m.from + m.to + (m.promotion ?? ''),
        t: match.movesList[i]?.timestamp
      }));
      this.queue.push({ matchId: match.matchId, moves, match });
      void this.drain();
    } catch (error) {
      console.warn('[FairPlay] could not queue game:', error);
    }
  }

  /** Browser-reported signals. Weak evidence: stored for context, never acted on alone. */
  recordClientSignal(uid: string | null, reason: string): boolean {
    if (!CLIENT_REASONS.has(reason)) return false;
    this.append({ type: 'client_signal', at: Date.now(), uid, reason });
    return true;
  }

  /** Latest analysed games for a player, oldest first. */
  historyOf(uid: string): FairPlayRecord[] {
    return this.history.get(uid) ?? [];
  }

  /** Games whose verdict is 'review', newest first. */
  reviewQueue(limit = 50): FairPlayRecord[] {
    const out: FairPlayRecord[] = [];
    for (const list of this.history.values()) out.push(...list.filter(r => r.verdict === 'review'));
    return out.sort((a, b) => b.at - a.at).slice(0, limit);
  }

  /** Verdict for one analysed game, folding in the player's recent history. */
  assess(uid: string, stats: SideStats, rating: number): Assessment {
    const base = assessSide(stats, rating);
    return escalateWithHistory(base, this.historyOf(uid).map(r => ({ verdict: r.verdict, at: r.at })));
  }

  /** Records an analysis result for both players of a game. */
  recordGame(matchId: string, match: Pick<MatchSession, 'whiteUid' | 'blackUid' | 'whiteRating' | 'blackRating'>, analysis: GameAnalysis): FairPlayRecord[] {
    const sides: ['w' | 'b', string, number][] = [
      ['w', match.whiteUid, match.whiteRating ?? 1200],
      ['b', match.blackUid, match.blackRating ?? 1200]
    ];
    const records: FairPlayRecord[] = [];
    for (const [color, uid, rating] of sides) {
      const assessment = this.assess(uid, analysis[color], rating);
      const record: FairPlayRecord = {
        type: 'game', at: Date.now(), matchId, uid, color, rating,
        stats: analysis[color], verdict: assessment.verdict, engineScore: assessment.engineScore, reasons: assessment.reasons
      };
      this.append(record);
      records.push(record);
      if (record.verdict === 'review') {
        console.warn(`[FairPlay] REVIEW ${uid} in ${matchId}: ${record.reasons.join('; ')}`);
      }
    }
    return records;
  }

  /* -------------------------------------------------------------- */

  private async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!;
        try {
          const analysis = await this.analyseInWorker(job.moves);
          this.recordGame(job.matchId, job.match, analysis);
        } catch (error) {
          console.warn(`[FairPlay] analysis of ${job.matchId} failed:`, error instanceof Error ? error.message : error);
        }
      }
    } finally {
      this.busy = false;
    }
  }

  private spawnWorker(): Worker {
    const production = process.env.NODE_ENV === 'production';
    const worker = production
      ? new Worker(path.join(process.cwd(), 'dist', 'fairPlayWorker.cjs'))
      : new Worker(path.join(process.cwd(), 'server', 'security', 'fairPlayWorker.ts'), { execArgv: ['--import', 'tsx'] });
    worker.unref(); // an idle worker must not keep the server process alive
    return worker;
  }

  private analyseInWorker(moves: AnalysedMove[]): Promise<GameAnalysis> {
    return new Promise((resolve, reject) => {
      const worker = (this.worker ??= this.spawnWorker());
      const id = this.nextJobId++;
      const done = (fn: () => void) => {
        clearTimeout(timer);
        worker.off('message', onMessage);
        worker.off('error', onError);
        fn();
      };
      const onMessage = (msg: { id: number; ok: boolean; result?: GameAnalysis; error?: string }) => {
        if (msg.id !== id) return;
        done(() => (msg.ok ? resolve(msg.result!) : reject(new Error(msg.error))));
      };
      const onError = (error: Error) => done(() => { this.worker = null; reject(error); });
      const timer = setTimeout(() => done(() => {
        void worker.terminate();
        this.worker = null;
        reject(new Error('analysis timed out'));
      }), JOB_TIMEOUT_MS);
      worker.on('message', onMessage);
      worker.on('error', onError);
      worker.postMessage({ id, moves, options: { depth: 4, perPlyMs: 3000 } });
    });
  }

  private append(record: LogRecord): void {
    if (record.type === 'game') {
      const list = this.history.get(record.uid) ?? [];
      list.push(record);
      if (list.length > MAX_HISTORY_PER_PLAYER) list.shift();
      this.history.set(record.uid, list);
    }
    fs.promises.mkdir(path.dirname(this.logFile), { recursive: true })
      .then(() => fs.promises.appendFile(this.logFile, JSON.stringify(record) + '\n'))
      .catch(error => console.warn('[FairPlay] could not write log:', error instanceof Error ? error.message : error));
  }

  private load(): void {
    try {
      const lines = fs.readFileSync(this.logFile, 'utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        const record = JSON.parse(line) as LogRecord;
        if (record.type !== 'game') continue;
        const list = this.history.get(record.uid) ?? [];
        list.push(record);
        if (list.length > MAX_HISTORY_PER_PLAYER) list.shift();
        this.history.set(record.uid, list);
      }
    } catch {
      // no log yet, or an unreadable line: start with what we have
    }
  }
}

export const fairPlay = new FairPlayService();
