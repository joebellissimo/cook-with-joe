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
function playPop(frequency) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
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
  playPop(880);
}

export function playIngredientUncheckedSound() {
  playPop(587);
}
