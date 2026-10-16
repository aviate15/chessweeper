// Shared fakes for online client tests. Not part of the app bundle.
import type { SocketLike, Timers } from "./client";

export class FakeSocket implements SocketLike {
  readyState = 0;
  readonly sent: unknown[] = [];
  closedWith: number | null | undefined = undefined;
  onopen: (() => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onclose: ((event: { readonly code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(code?: number): void {
    this.closedWith = code ?? null;
    this.readyState = 3;
  }

  // ---- test controls ----
  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: unknown): void {
    this.onmessage?.({ data: typeof message === "string" ? message : JSON.stringify(message) });
  }
  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

interface Timer {
  at: number;
  fn: () => void;
  every: number | null;
}

/** Timers that only move when a test advances them. */
export class FakeTimers implements Timers {
  private t = 0;
  private nextId = 1;
  private readonly timers = new Map<number, Timer>();

  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.set(id, { at: this.t + ms, fn, every: null });
    return id;
  }
  clearTimeout(handle: unknown): void {
    if (typeof handle === "number") this.timers.delete(handle);
  }
  setInterval(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.set(id, { at: this.t + ms, fn, every: ms });
    return id;
  }
  clearInterval(handle: unknown): void {
    this.clearTimeout(handle);
  }
  pending(): number {
    return this.timers.size;
  }
  advance(ms: number): void {
    const target = this.t + ms;
    for (;;) {
      let nextId: number | null = null;
      let nextAt = Infinity;
      for (const [id, timer] of this.timers) {
        if (timer.at <= target && timer.at < nextAt) {
          nextId = id;
          nextAt = timer.at;
        }
      }
      if (nextId === null) break;
      const timer = this.timers.get(nextId);
      if (timer === undefined) break;
      this.t = Math.max(this.t, timer.at);
      if (timer.every === null) this.timers.delete(nextId);
      else timer.at += timer.every;
      timer.fn();
    }
    this.t = target;
  }
}
