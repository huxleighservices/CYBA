/**
 * 8-bit sound effects via Web Audio API — no external files needed.
 * All functions are no-ops on the server and safe to import in any client component.
 */

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  if (!w.__sfxCtx) {
    try {
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return null;
      w.__sfxCtx = new AC();
    } catch { return null; }
  }
  const c: AudioContext = w.__sfxCtx;
  if (c.state === 'suspended') c.resume().catch(() => {});
  return c;
}

/** Low-level: schedule a single square/triangle note */
function note(
  c: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  vol: number,
  type: OscillatorType = 'square',
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(vol, startTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// ─── Wheel sounds ───────────────────────────────────────────────

/**
 * Start the wheel spin — plays a launch sweep then schedules all ticks
 * via the audio clock (stays accurate even if tab is hidden).
 * Returns a cleanup function to cancel early if needed.
 */
export function sfxWheelSpin(durationSec = 4.5): () => void {
  const c = getCtx();
  if (!c) return () => {};

  const now = c.currentTime;

  // ── Launch sweep (sawtooth rise) ──
  const sweep = c.createOscillator();
  const sweepG = c.createGain();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(80, now);
  sweep.frequency.exponentialRampToValueAtTime(600, now + 0.35);
  sweepG.gain.setValueAtTime(0.22, now);
  sweepG.gain.linearRampToValueAtTime(0, now + 0.35);
  sweep.connect(sweepG);
  sweepG.connect(c.destination);
  sweep.start(now);
  sweep.stop(now + 0.38);

  // ── Tick track: fast → slow (exponential spacing) ──
  const oscs: OscillatorNode[] = [];
  let t = 0.15;
  let interval = 0.042; // ~24 ticks/sec at peak
  while (t < durationSec - 0.05) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 900;
    g.gain.setValueAtTime(0, now + t);
    g.gain.linearRampToValueAtTime(0.08, now + t + 0.004);
    g.gain.linearRampToValueAtTime(0, now + t + 0.028);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.035);
    oscs.push(osc);
    // Ease out: each gap grows by ~3%
    interval = Math.min(0.55, interval * 1.028);
    t += interval;
  }

  return () => oscs.forEach(o => { try { o.stop(); } catch {} });
}

/** Final "clunk" when wheel stops */
export function sfxWheelStop() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  note(c, 220, now, 0.12, 0.25, 'square');
  note(c, 110, now + 0.05, 0.15, 0.2, 'square');
}

/** Coins win — ascending C major arpeggio */
export function sfxWinCoins() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  [261.63, 329.63, 392.00, 523.25, 659.25].forEach((f, i) => {
    note(c, f, now + i * 0.09, 0.18, 0.22);
  });
}

/** Big prize / boost win — victory fanfare */
export function sfxWinBig() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  // Rapid ascending triad then held chord + sparkle
  const melody = [261.63, 329.63, 392.00, 523.25, 659.25, 523.25, 659.25, 1046.50];
  melody.forEach((f, i) => {
    note(c, f, now + i * 0.1, i >= 6 ? 0.45 : 0.1, 0.2);
  });
  // Harmony layer
  [523.25, 659.25, 783.99].forEach(f => {
    note(c, f, now + 0.75, 0.5, 0.1, 'triangle');
  });
}

/** Activate boost */
export function sfxBoostActivate() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  [440, 554.37, 659.25, 880].forEach((f, i) => {
    note(c, f, now + i * 0.07, 0.15, 0.18, 'triangle');
  });
}

// ─── Quest sounds ────────────────────────────────────────────────

/** Soft blip when tapping a quest node */
export function sfxQuestSelect() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  note(c, 660, now, 0.05, 0.18);
  note(c, 880, now + 0.06, 0.05, 0.12);
}

/** Panel slides open */
export function sfxQuestOpen() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(600, now + 0.12);
  g.gain.setValueAtTime(0.15, now);
  g.gain.linearRampToValueAtTime(0, now + 0.15);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

/** Quest claimable ping (plays on the node when claimable) */
export function sfxQuestReady() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  note(c, 880, now, 0.08, 0.2);
  note(c, 1108, now + 0.1, 0.08, 0.16);
}

/** Full level-up jingle when claiming a quest */
export function sfxQuestClaim() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  // C major scale ascending
  const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
  scale.forEach((f, i) => {
    note(c, f, now + i * 0.07, 0.12, 0.18);
  });
  // Final triumphant chord
  [523.25, 659.25, 783.99, 1046.50].forEach(f => {
    note(c, f, now + scale.length * 0.07 + 0.05, 0.6, 0.14, 'triangle');
  });
}

/** Quick "denied" buzz for locked quest */
export function sfxLocked() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  note(c, 160, now, 0.08, 0.18, 'sawtooth');
  note(c, 120, now + 0.1, 0.1, 0.15, 'sawtooth');
}
