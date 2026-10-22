/**
 * Alert tones for the command center.
 *
 * Synthesised with WebAudio rather than shipped as files: three short tones
 * cost no bytes on a slow Sinai connection and need no asset pipeline. Each
 * kind of event has its own shape, so the desk can tell a food order from a
 * room booking without looking up.
 *
 * Browsers refuse to play audio before the page has been interacted with, so
 * the context is created lazily and resumed on the first pointer or key press
 * (see `unlockAlertSounds`). The mute choice is a per-viewer convenience kept
 * in localStorage; every access is guarded, so a blocked store just means
 * sound defaults to on.
 */

export type AlertKind = 'dining' | 'stay' | 'support';

const MUTE_KEY = 'dahab.ops.alertsMuted';

// Notes as [frequency Hz, start offset s, duration s].
const TONES: Record<AlertKind, Array<[number, number, number]>> = {
  // Bright two-note "ding-ding": a kitchen order needs confirming now.
  dining: [[880, 0, 0.16], [1175, 0.18, 0.22]],
  // Rising three-note chime: a stay is paid and waiting for approval.
  stay: [[659, 0, 0.14], [784, 0.15, 0.14], [988, 0.3, 0.28]],
  // Single soft blip: a new guest message.
  support: [[620, 0, 0.18]],
};

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function isAlertSoundMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAlertSoundMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Storage blocked: the toggle still works for this page view.
  }
}

/** Call once from a user gesture so later, unprompted alerts can play. */
export function unlockAlertSounds(): void {
  const audio = context();
  if (audio && audio.state === 'suspended') void audio.resume().catch(() => {});
}

export function playAlertSound(kind: AlertKind, { force = false }: { force?: boolean } = {}): void {
  if (!force && isAlertSoundMuted()) return;
  const audio = context();
  if (!audio || audio.state !== 'running') return;

  const now = audio.currentTime;
  for (const [freq, offset, duration] of TONES[kind]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Short attack and exponential release: a chime, not a click or a beep.
    const start = now + offset;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

/**
 * Keeps ringing until someone answers. A single chime is easy to miss at a
 * busy desk, so an arrival repeats its tone every few seconds until the
 * operator dismisses it (`stopAlertLoop`). Several kinds can ring at once;
 * each tick plays every active kind, staggered so they do not overlap.
 */
const LOOP_EVERY_MS = 4000;
const ringing = new Set<AlertKind>();
let loopTimer: number | null = null;

function tick(): void {
  [...ringing].forEach((kind, i) => window.setTimeout(() => playAlertSound(kind), i * 700));
}

export function startAlertLoop(kind: AlertKind): void {
  ringing.add(kind);
  if (loopTimer === null) {
    tick();
    loopTimer = window.setInterval(tick, LOOP_EVERY_MS);
  }
}

export function stopAlertLoop(kind?: AlertKind): void {
  if (kind) ringing.delete(kind);
  else ringing.clear();
  if (ringing.size === 0 && loopTimer !== null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
  }
}

/**
 * Ids present now but not in `seen`. The first call (seen === null) only
 * records the baseline, so opening the dashboard does not ring for every
 * order already waiting.
 */
export function newIds(current: readonly string[], seen: Set<string> | null): string[] {
  if (seen === null) return [];
  return current.filter(id => !seen.has(id));
}
