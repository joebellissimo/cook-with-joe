// Short synthesized UI sound effects via the Web Audio API — no audio files
// to load, just a couple of oscillator blips. Kept as a shared helper since
// nothing here is specific to the recipe player.

let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

// A brief tone (~100ms) with a quick attack and decay, so it reads as a
// crisp blip rather than a jarring beep. Volume stays modest — this is a
// background confirmation cue for a kitchen environment, not an alert.
// startOffset schedules the note startOffset seconds into the future
// (against the AudioContext's own clock, not setTimeout) — how
// playConfirmationChime below sequences its two notes precisely.
function playTone(frequency, startOffset = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + startOffset;
  const duration = 0.1;
  const peakGain = 0.12;

  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(peakGain, now + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

// Slightly higher pitch for checking, slightly lower for unchecking, so the
// two are subtly distinguishable by ear without needing to look.
export function playIngredientCheckedSound() {
  playTone(880);
}

export function playIngredientUncheckedSound() {
  playTone(587);
}

// Shared confirmation cue — a quick two-note ascending "ding," distinct
// from the single-pitch pops above. Used broadly across the app as "the
// app finished processing that command" (selecting I have/Need to get,
// copying the list, marking a step done, ...) and doubles as the
// implicit "safe to say the next thing" signal for voice, since it
// fires exactly when processing completes — no separate ready tone.
export function playConfirmationChime() {
  playTone(660);
  playTone(880, 0.09);
}

// Explicitly warms/unlocks the AudioContext from within a real user
// gesture (a click — most reliably the mic toggle button, since that's
// the one action guaranteed to happen before any voice-triggered sound
// needs to play). Voice-triggered chimes fire from SpeechRecognition's
// onresult callback, which iOS Safari does NOT treat as a user gesture —
// without an earlier real click having already unlocked the context,
// those chimes would silently fail to play. Once unlocked, the context
// stays unlocked for the rest of the page's life; this just makes sure
// that happens on a gesture that's actually guaranteed to occur first.
export function unlockAudioContext() {
  getAudioContext();
}
