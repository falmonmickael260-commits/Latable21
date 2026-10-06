"use client";

// Every effect here is synthesized on the fly with the WebAudio API — no
// bundled audio files, no third-party sample licensing to track. Each sounds
// discreet and dry, matching the "premium, not arcade" brief.

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

let muted = false;
export function setMuted(value: boolean) {
  muted = value;
}
export function isMuted() {
  return muted;
}

function envGain(c: AudioContext, start: number, peak: number, attack: number, release: number, startAt = 0) {
  const g = c.createGain();
  const t0 = c.currentTime + startAt;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
  return g;
}

function tone(freq: number, { attack = 0.004, release = 0.12, peak = 0.22, type = "sine" as OscillatorType, startAt = 0 } = {}) {
  const c = getCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = envGain(c, 0, peak, attack, release, startAt);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + startAt);
  osc.stop(c.currentTime + startAt + attack + release + 0.05);
}

function noiseBurst({ duration = 0.05, peak = 0.12, filterFreq = 3500, startAt = 0 } = {}) {
  const c = getCtx();
  if (!c || muted) return;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = filterFreq;
  const g = envGain(c, 0, peak, 0.002, duration, startAt);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(c.currentTime + startAt);
}

export const sfx = {
  cardSlide: () => noiseBurst({ duration: 0.09, peak: 0.1, filterFreq: 1800 }),
  cardFlip: () => {
    noiseBurst({ duration: 0.05, peak: 0.14, filterFreq: 2500 });
    tone(680, { attack: 0.002, release: 0.05, peak: 0.05, type: "triangle", startAt: 0.02 });
  },
  chip: () => {
    tone(1800, { attack: 0.001, release: 0.04, peak: 0.08, type: "square" });
    tone(2600, { attack: 0.001, release: 0.03, peak: 0.05, type: "square", startAt: 0.02 });
  },
  buttonHover: () => tone(900, { attack: 0.001, release: 0.02, peak: 0.03, type: "sine" }),
  buttonClick: () => tone(500, { attack: 0.001, release: 0.05, peak: 0.07, type: "triangle" }),
  win: () => {
    [523.25, 659.25, 783.99].forEach((f, i) => tone(f, { attack: 0.005, release: 0.3, peak: 0.1, type: "sine", startAt: i * 0.08 }));
  },
  blackjack: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(f, { attack: 0.004, release: 0.45, peak: 0.13, type: "sine", startAt: i * 0.09 }),
    );
  },
  lose: () => tone(180, { attack: 0.01, release: 0.4, peak: 0.08, type: "sawtooth" }),
  bust: () => {
    noiseBurst({ duration: 0.12, peak: 0.1, filterFreq: 900 });
    tone(220, { attack: 0.002, release: 0.22, peak: 0.1, type: "sawtooth" });
    tone(146, { attack: 0.002, release: 0.3, peak: 0.08, type: "sawtooth", startAt: 0.05 });
  },
};
