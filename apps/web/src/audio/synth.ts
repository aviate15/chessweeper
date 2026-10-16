import type { Cue } from "./cues";

const MASTER_GAIN = 0.3;
const MAX_VOICES = 8;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voices = 0;
let noise: AudioBuffer | null = null;

type Ctor = typeof AudioContext;

export function initContext(): void {
  try {
    if (ctx === null) {
      const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
      const C = g.AudioContext ?? g.webkitAudioContext;
      if (C === undefined) return;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  } catch {
    ctx = null;
    master = null;
  }
}

export function hasContext(): boolean {
  return ctx !== null;
}

/** Test hook. */
export function resetSynthForTests(): void {
  ctx = null;
  master = null;
  voices = 0;
  noise = null;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise === null) {
    const len = Math.floor(c.sampleRate * 0.5);
    noise = c.createBuffer(1, len, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

interface Voice {
  c: AudioContext;
  out: AudioNode;
  t: number;
}

function env(c: AudioContext, t: number, peak: number, dur: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function release(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  voices++;
  src.onended = () => {
    voices--;
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        // already disconnected
      }
    }
  };
}

function tone(
  v: Voice,
  type: OscillatorType,
  f0: number,
  f1: number,
  start: number,
  dur: number,
  peak: number,
): void {
  const o = v.c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, v.t + start);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, v.t + start + dur);
  const g = env(v.c, v.t + start, peak, dur);
  o.connect(g).connect(v.out);
  o.start(v.t + start);
  o.stop(v.t + start + dur + 0.02);
  release(o, [o, g]);
}

function burst(
  v: Voice,
  start: number,
  dur: number,
  peak: number,
  f0: number,
  f1: number,
  kind: BiquadFilterType = "lowpass",
): void {
  const s = v.c.createBufferSource();
  s.buffer = noiseBuffer(v.c);
  const f = v.c.createBiquadFilter();
  f.type = kind;
  f.frequency.setValueAtTime(f0, v.t + start);
  f.frequency.exponentialRampToValueAtTime(f1, v.t + start + dur);
  const g = env(v.c, v.t + start, peak, dur);
  s.connect(f).connect(g).connect(v.out);
  s.start(v.t + start);
  s.stop(v.t + start + dur + 0.02);
  release(s, [s, f, g]);
}

const RECIPES: Record<Cue, (v: Voice) => void> = {
  click: (v) => {
    tone(v, "square", 1800, 1200, 0, 0.02, 0.25);
  },
  move: (v) => {
    tone(v, "square", 330, 220, 0, 0.07, 0.3);
    burst(v, 0, 0.05, 0.2, 2500, 600, "bandpass");
  },
  capture: (v) => {
    tone(v, "square", 220, 110, 0, 0.12, 0.35);
    burst(v, 0, 0.12, 0.4, 3500, 500, "bandpass");
  },
  flag: (v) => {
    tone(v, "triangle", 520, 520, 0, 0.05, 0.3);
    tone(v, "triangle", 780, 780, 0.05, 0.07, 0.3);
  },
  reveal: (v) => {
    tone(v, "square", 660, 990, 0, 0.09, 0.22);
  },
  explosion: (v) => {
    burst(v, 0, 0.38, 0.9, 5000, 120);
    tone(v, "sine", 110, 35, 0, 0.3, 0.8);
  },
  kingHit: (v) => {
    tone(v, "sawtooth", 440, 70, 0, 0.35, 0.4);
    burst(v, 0, 0.3, 0.5, 3000, 150);
  },
  check: (v) => {
    tone(v, "square", 880, 880, 0, 0.08, 0.28);
    tone(v, "square", 880, 880, 0.12, 0.08, 0.28);
  },
  reshuffle: (v) => {
    [262, 330, 392, 523, 660].forEach((f, i) => {
      tone(v, "square", f, f, i * 0.05, 0.07, 0.22);
    });
  },
  gameOver: (v) => {
    [523, 440, 349, 262].forEach((f, i) => {
      tone(v, "triangle", f, f * 0.97, i * 0.09, 0.12, 0.4);
    });
  },
};

export function play(cue: Cue, delay = 0): void {
  if (ctx === null || master === null) return;
  if (voices >= MAX_VOICES) return;
  try {
    RECIPES[cue]({ c: ctx, out: master, t: ctx.currentTime + delay });
  } catch {
    // never let audio break the game
  }
}
