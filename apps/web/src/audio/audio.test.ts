import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isMuted,
  playCue,
  playCues,
  setMuted,
  subscribeMuted,
  unlockAudio,
  type Cue,
} from "./index";
import { resetSettingsForTests } from "./settings";
import { resetSynthForTests } from "./synth";

const ALL: Cue[] = [
  "move",
  "capture",
  "flag",
  "reveal",
  "explosion",
  "kingHit",
  "check",
  "reshuffle",
  "gameOver",
  "click",
];

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => {
      m.clear();
    },
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

beforeEach(() => {
  resetSettingsForTests();
  resetSynthForTests();
  vi.stubGlobal("localStorage", memoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("without an AudioContext", () => {
  it("every function is a safe no-op", () => {
    expect(() => {
      playCue("click");
      playCues([]);
      unlockAudio();
      for (const c of ALL) playCue(c);
    }).not.toThrow();
  });
});

describe("muted setting", () => {
  it("defaults to unmuted and persists", () => {
    expect(isMuted()).toBe(false);
    setMuted(true);
    expect(globalThis.localStorage.getItem("chessweeper.muted")).toBe("1");
    resetSettingsForTests();
    expect(isMuted()).toBe(true);
  });

  it("survives throwing storage", () => {
    const boom = (): never => {
      throw new Error("denied");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
    expect(isMuted()).toBe(false);
    expect(() => {
      setMuted(true);
    }).not.toThrow();
    expect(isMuted()).toBe(true);
  });

  it("notifies subscribers until unsubscribed", () => {
    const fn = vi.fn();
    const off = subscribeMuted(fn);
    setMuted(true);
    setMuted(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(true);
    off();
    setMuted(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("with a fake AudioContext", () => {
  let started: number;
  beforeEach(() => {
    started = 0;
    const node = (): Record<string, unknown> => {
      const n: Record<string, unknown> = {
        connect: (d: unknown) => d ?? n,
        disconnect: () => undefined,
        start: () => {
          started++;
        },
        stop: () => undefined,
        gain: {
          value: 1,
          setValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        frequency: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
      };
      return n;
    };
    class Fake {
      state = "running";
      currentTime = 0;
      sampleRate = 100;
      destination = {};
      createGain = node;
      createOscillator = node;
      createBufferSource = node;
      createBiquadFilter = node;
      createBuffer = () => ({ getChannelData: () => new Float32Array(50) });
      resume = () => Promise.resolve();
    }
    vi.stubGlobal("AudioContext", Fake);
  });

  it("plays every cue after unlock, capped by the voice limit", () => {
    unlockAudio();
    for (const c of ALL) playCue(c);
    expect(started).toBeGreaterThan(0);
    const before = started;
    for (let i = 0; i < 100; i++) playCue("explosion");
    expect(started - before).toBeLessThan(100);
  });

  it("is silent when muted", () => {
    unlockAudio();
    setMuted(true);
    playCue("click");
    expect(started).toBe(0);
  });
});
