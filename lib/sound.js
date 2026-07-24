// Short synthesized UI sound effects via the Web Audio API — no audio files
// to load, just a couple of oscillator blips. Kept as a shared helper since
// nothing here is specific to the recipe player.

let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  // "closed" (not just falsy/missing) covers iOS fully tearing the context
  // down after extended background time — recreate rather than hand back a
  // permanently-dead context that every tone request would silently no-op
  // against forever.
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

// iOS Safari suspends (or, after extended backgrounding, fully tears down)
// the AudioContext whenever the tab is backgrounded — e.g. phone lock.
// Coming back to the tab isn't itself a user gesture, so this is a
// best-effort proactive recovery (reusing getAudioContext's own
// resume/recreate logic, not a second copy of it) rather than the sole
// guarantee — the real guarantee is the resume-before-play in
// getRunningContext below, plus the explicit unlockAudioContext() calls in
// RecipePlayer's click handlers.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") getAudioContext();
  });
}

// Resolves once the context is actually producing audio (or gives up
// silently) — awaited before scheduling a tone so a sound request right
// after unlock/resume doesn't get scheduled against a context that's still
// technically suspended.
async function ensureRunning(ctx) {
  if (ctx.state === "running") return;
  try {
    await ctx.resume();
  } catch {
    // best effort — scheduleTone below will just be inaudible this time
  }
}

async function getRunningContext() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  await ensureRunning(ctx);
  return ctx;
}

// A brief tone (~100ms) with a quick attack and decay, so it reads as a
// crisp blip rather than a jarring beep. Volume stays modest — this is a
// background confirmation cue for a kitchen environment, not an alert.
// startOffset schedules the note startOffset seconds into the future
// (against the AudioContext's own clock, not setTimeout) — how
// playConfirmationChime below sequences its two notes precisely.
function scheduleTone(ctx, frequency, startOffset = 0) {
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

async function playTone(frequency, startOffset = 0) {
  const ctx = await getRunningContext();
  if (!ctx) return;
  scheduleTone(ctx, frequency, startOffset);
}

// Slightly higher pitch for checking, slightly lower for unchecking, so the
// two are subtly distinguishable by ear without needing to look.
export async function playIngredientCheckedSound() {
  await playTone(880);
}

export async function playIngredientUncheckedSound() {
  await playTone(587);
}

// Shared confirmation cue — a quick two-note ascending "ding," distinct
// from the single-pitch pops above. Used broadly across the app as "the
// app finished processing that command" (selecting I have/Need to get,
// copying the list, marking a step done, ...) and doubles as the
// implicit "safe to say the next thing" signal for voice, since it
// fires exactly when processing completes — no separate ready tone.
// Both notes are scheduled off one shared ctx.currentTime read (after a
// single getRunningContext() await), so the 0.09s gap between them stays
// precise even if resuming from suspended took a moment.
export async function playConfirmationChime() {
  const ctx = await getRunningContext();
  if (!ctx) return;
  scheduleTone(ctx, 660, 0);
  scheduleTone(ctx, 880, 0.09);
}

// Explicitly warms/unlocks (and, if needed, resumes or recreates) the
// AudioContext from within a real user gesture. Called from every click
// handler in RecipePlayer.jsx that's a genuine tap — mic toggle, I
// have/Need to get radios, copy list, done — as belt-and-suspenders on top
// of the resume-before-play above, since some of those gestures don't
// themselves trigger a chime and would otherwise have no chance to recover
// a suspended/closed context before the next voice-triggered one needs it.
export function unlockAudioContext() {
  getAudioContext();
}
