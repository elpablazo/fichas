// The audio context (§14.4): created off the critical path, unlocked inside a tap. The marimba itself is in
// sound.ts, loaded at idle.
let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let click: AudioBuffer | null = null;
let soundOn = true;
export function setSoundOn(v: boolean): void {
  soundOn = v;
}

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

/** The context to play on, or null when sound is off or unavailable. */
export function audio(): { ctx: AudioContext; bus: GainNode; click: AudioBuffer | null } | null {
  return soundOn && ctx && bus ? { ctx, bus, click } : null;
}
