// Synthesized marimba (Web Audio), never an error sound (§14.4). A wooden mallet: a sine body with a fast-
// decaying 4th partial and a soft click, through a small echo so rewards feel warm rather than beepy.
let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let click: AudioBuffer | null = null;
export let soundOn = true;
export function setSoundOn(v: boolean): void {
  soundOn = v;
}

// C major pentatonic from C5.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

/** Creates the (suspended) context off the critical path; creating one costs ~150 ms on slow Android. */
export function prepareAudio(): void {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    bus = ctx.createGain();
    bus.gain.value = 0.9;
    const echo = ctx.createDelay(0.5);
    echo.delayTime.value = 0.16;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    bus.connect(ctx.destination);
    bus.connect(echo);
    echo.connect(feedback).connect(echo);
    echo.connect(wet).connect(ctx.destination);
    click = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.012), ctx.sampleRate);
    const data = click.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  } catch {
    ctx = null;
  }
}

/** Call inside a tap: iOS only starts audio when resume() runs in a user gesture. */
export function unlockAudio(): void {
  prepareAudio();
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
}

function mallet(freq: number, at: number, gain = 0.13, decay = 0.55): void {
  if (!ctx || !bus) return;
  const body = ctx.createOscillator();
  const partial = ctx.createOscillator();
  const g1 = ctx.createGain();
  const g2 = ctx.createGain();
  body.type = 'sine';
  partial.type = 'sine';
  body.frequency.value = freq;
  partial.frequency.value = freq * 3.93;
  g1.gain.setValueAtTime(0, at);
  g1.gain.linearRampToValueAtTime(gain, at + 0.004);
  g1.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  g2.gain.setValueAtTime(0, at);
  g2.gain.linearRampToValueAtTime(gain * 0.3, at + 0.002);
  g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  body.connect(g1).connect(bus);
  partial.connect(g2).connect(bus);
  body.start(at);
  partial.start(at);
  body.stop(at + decay + 0.05);
  partial.stop(at + 0.1);
  if (click) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = click;
    filter.type = 'bandpass';
    filter.frequency.value = Math.min(6000, freq * 4);
    g.gain.value = gain * 0.35;
    src.connect(filter).connect(g).connect(bus);
    src.start(at);
  }
}

function now(): number | null {
  if (!soundOn || !ctx) return null;
  return ctx.currentTime + 0.01;
}

/** One rising note per token (60 ms stagger); the last one an octave up when the meal is on plan. */
export function playTokens(n: number, octaveUpLast: boolean): void {
  const t0 = now();
  if (t0 === null || n <= 0) return;
  const count = Math.min(n, 12);
  for (let i = 0; i < count; i++) {
    const f = NOTES[i % NOTES.length] ?? 523.25;
    mallet(i === count - 1 && octaveUpLast ? f * 2 : f, t0 + i * 0.06, 0.12);
  }
}

/** Today's plant grew a stage. */
export function playGrow(): void {
  const t = now();
  if (t === null) return;
  mallet(783.99, t, 0.08, 0.4);
  mallet(1046.5, t + 0.09, 0.09, 0.6);
}

/** A flower opens: a bright rising arpeggio. */
export function playBloom(): void {
  const t = now();
  if (t === null) return;
  for (const [i, f] of [523.25, 659.25, 783.99, 1046.5, 1318.51].entries()) mallet(f, t + i * 0.07, 0.1, 0.7);
}

export function playThunk(): void {
  const t = now();
  if (t === null) return;
  mallet(196, t, 0.2, 0.25);
}

/** Day close: a gentle chord, then the octave. */
export function playChord(): void {
  const t = now();
  if (t === null) return;
  for (const f of [523.25, 659.25, 783.99]) mallet(f, t, 0.07, 1.1);
  mallet(1046.5, t + 0.32, 0.08, 1.2);
}

/** Level up, discoveries and surprises. */
export function playArpeggio(): void {
  const t = now();
  if (t === null) return;
  for (const [i, f] of [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093].entries())
    mallet(f, t + i * 0.055, 0.085, 0.6);
}
