export interface Limits {
  /** ws maxPayload in bytes. Larger frames close the connection. */
  readonly maxPayloadBytes: number;
  readonly maxConnectionsPerIp: number;
  readonly maxRoomsPerIp: number;
  readonly maxRooms: number;
  /** Token bucket per connection: burst size and sustained messages per second. */
  readonly messageBurst: number;
  readonly messagesPerSecond: number;
  /** Disconnect grace before the opponent may claim the win (design doc 3.6: 60 s). */
  readonly graceMs: number;
  /** A room with nobody connected is dropped after this long. */
  readonly emptyRoomMs: number;
  /** A room with no activity at all is dropped after this long (30 min). */
  readonly idleRoomMs: number;
  /** A room whose game is over is dropped this long after it ended, so both can load the result. */
  readonly finishedRoomMs: number;
  /** Manual mine mode: how long each placement round lasts (design doc 3.10: 20 s). */
  readonly placementMs: number;
}

export const DEFAULT_LIMITS: Limits = {
  maxPayloadBytes: 2048,
  maxConnectionsPerIp: 100,
  maxRoomsPerIp: 30,
  maxRooms: 1000,
  messageBurst: 20,
  messagesPerSecond: 5,
  graceMs: 60_000,
  emptyRoomMs: 5 * 60_000,
  idleRoomMs: 30 * 60_000,
  finishedRoomMs: 2 * 60_000,
  placementMs: 20_000,
};

export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
    now: number,
  ) {
    this.tokens = capacity;
    this.last = now;
  }

  /** Takes one token if available. */
  take(now: number): boolean {
    const elapsed = Math.max(0, now - this.last);
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + (elapsed / 1000) * this.perSecond);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
