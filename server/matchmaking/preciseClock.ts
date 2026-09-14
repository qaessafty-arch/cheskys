export interface PlayerClockState {
  remainingMs: number;
  lastTurnStartHr: bigint;
  incrementMs: number;
}

export interface ClockSnapshot {
  whiteMs: number;
  blackMs: number;
  whiteSecondsRemaining: number;
  blackSecondsRemaining: number;
  activeColor: 'w' | 'b';
  lastMoveTimestamp: number;
}

export class PrecisionMatchClock {
  private white: PlayerClockState;
  private black: PlayerClockState;
  private activeColor: 'w' | 'b';
  private flagTimeout: NodeJS.Timeout | null = null;
  private onFlagCallback: (flaggedColor: 'w' | 'b') => void;
  private isRunning: boolean = false;

  constructor(
    initialSeconds: number,
    incrementSeconds: number,
    onFlag: (color: 'w' | 'b') => void
  ) {
    this.white = {
      remainingMs: Math.max(0, initialSeconds * 1000),
      lastTurnStartHr: process.hrtime.bigint(),
      incrementMs: Math.max(0, incrementSeconds * 1000),
    };
    this.black = {
      remainingMs: Math.max(0, initialSeconds * 1000),
      lastTurnStartHr: process.hrtime.bigint(),
      incrementMs: Math.max(0, incrementSeconds * 1000),
    };
    this.activeColor = 'w';
    this.onFlagCallback = onFlag;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.recordTurnStart();
    this.armFlagTimer();
  }

  public pause(): void {
    if (!this.isRunning) return;
    this.deductActiveElapsed(0);
    this.clearFlagTimer();
    this.isRunning = false;
  }

  public resume(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.recordTurnStart();
    this.armFlagTimer();
  }

  /**
   * Switches turns upon move execution and applies NTP lag compensation.
   * @param clientReportedRttMs Round-trip time measured by ping-pong
   */
  public switchTurn(clientReportedRttMs: number = 0): ClockSnapshot {
    if (!this.isRunning) {
      this.start();
    }

    // Network latency compensation: deduct one-way trip delay (RTT / 2), capped at 400ms to prevent cheat abuse
    const lagCompensationMs = Math.min(Math.max(0, clientReportedRttMs / 2), 400);
    this.deductActiveElapsed(lagCompensationMs);

    const active = this.getActivePlayer();
    if (active.remainingMs <= 0) {
      active.remainingMs = 0;
      this.clearFlagTimer();
      this.onFlagCallback(this.activeColor);
      return this.getSnapshot();
    }

    // Apply increment to player who just finished their turn
    active.remainingMs += active.incrementMs;

    // Toggle active side
    this.activeColor = this.activeColor === 'w' ? 'b' : 'w';
    this.recordTurnStart();
    this.armFlagTimer();

    return this.getSnapshot();
  }

  private deductActiveElapsed(lagCompensationMs: number): void {
    const now = process.hrtime.bigint();
    const active = this.getActivePlayer();
    const elapsedMs = Number((now - active.lastTurnStartHr) / 1_000_000n);
    const effectiveDeduction = Math.max(0, elapsedMs - lagCompensationMs);
    active.remainingMs = Math.max(0, active.remainingMs - effectiveDeduction);
  }

  private recordTurnStart(): void {
    this.getActivePlayer().lastTurnStartHr = process.hrtime.bigint();
  }

  private getActivePlayer(): PlayerClockState {
    return this.activeColor === 'w' ? this.white : this.black;
  }

  public getSnapshot(): ClockSnapshot {
    let whiteRemaining = this.white.remainingMs;
    let blackRemaining = this.black.remainingMs;

    if (this.isRunning) {
      const now = process.hrtime.bigint();
      const currentActive = this.getActivePlayer();
      const currentElapsed = Number((now - currentActive.lastTurnStartHr) / 1_000_000n);
      if (this.activeColor === 'w') {
        whiteRemaining = Math.max(0, whiteRemaining - currentElapsed);
      } else {
        blackRemaining = Math.max(0, blackRemaining - currentElapsed);
      }
    }

    const whiteRounded = Math.max(0, Math.round(whiteRemaining));
    const blackRounded = Math.max(0, Math.round(blackRemaining));

    return {
      whiteMs: whiteRounded,
      blackMs: blackRounded,
      whiteSecondsRemaining: Math.ceil(whiteRounded / 1000),
      blackSecondsRemaining: Math.ceil(blackRounded / 1000),
      activeColor: this.activeColor,
      lastMoveTimestamp: Date.now(),
    };
  }

  private armFlagTimer(): void {
    this.clearFlagTimer();
    const active = this.getActivePlayer();
    this.flagTimeout = setTimeout(() => {
      this.deductActiveElapsed(0);
      if (this.getActivePlayer().remainingMs <= 0) {
        this.onFlagCallback(this.activeColor);
      } else {
        this.armFlagTimer();
      }
    }, Math.max(10, active.remainingMs));
  }

  private clearFlagTimer(): void {
    if (this.flagTimeout) {
      clearTimeout(this.flagTimeout);
      this.flagTimeout = null;
    }
  }

  public destroy(): void {
    this.clearFlagTimer();
    this.isRunning = false;
  }
}
