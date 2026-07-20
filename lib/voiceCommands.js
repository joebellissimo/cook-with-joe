// Ordered most-specific-first: the first matching rule wins. "restart-video"
// and "continue-playing" must come before "next", since "continue" alone is
// a synonym for "next step" and would otherwise wrongly match phrases like
// "continue playing" first.
const RULES = [
  { action: "loop-off", test: /loop off|stop loop|stop looping|turn off (the )?loop|no loop/ },
  { action: "loop-on", test: /loop on|start loop|keep looping|loop this|turn on (the )?loop|repeat forever/ },
  { action: "show-ingredients", test: /show me ingredients|show ingredients|open ingredients/ },
  { action: "hide-ingredients", test: /hide ingredients|close ingredients|dismiss ingredients/ },
  { action: "first", test: /first step/ },
  { action: "repeat", test: /repeat|replay|again|restart (this|the) step/ },
  { action: "restart-video", test: /start over|from the beginning|restart (the )?(recipe|video)/ },
  { action: "continue-playing", test: /keep playing|play through|continue playing|just play/ },
  { action: "next", test: /next step|next|continue|move on|skip ahead/ },
  { action: "previous", test: /previous step|previous|go back|back up|last step/ },
  { action: "play", test: /^play$|resume|start video/ },
  { action: "pause", test: /^pause$|^stop$|stop video|hold on/ },
];

// Phrases like "play the mince onions step" or "go to chop garlic" — capture
// whatever comes after the trigger phrase as a candidate step reference.
const STEP_REFERENCE_PATTERN =
  /^(?:play|go to|jump to|switch to|start|do|show me|take me to)\s+(?:the\s+)?(.+?)(?:\s+step)?$/i;

// "loop prep breadcrumbs" / "loop the chop garlic step" — jump to a step by
// name AND turn loop mode on for it in one phrase. Checked separately from
// the plain STEP_REFERENCE_PATTERN above so "loop <step>" can carry the
// extra "and start looping" meaning, distinct from "play <step>".
const LOOP_STEP_PATTERN = /^loop\s+(?:the\s+)?(.+?)(?:\s+step)?$/i;

const STOP_WORDS = new Set([
  "the", "a", "an", "to", "step", "this", "that", "please", "now", "of", "on",
]);

function significantWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Find the step whose label shares the most significant words with the
 * given reference phrase (e.g. "prep breadcrumbs" -> the "Prep breadcrumbs"
 * step). Returns null if nothing shares at least one meaningful word.
 */
function findMatchingStep(reference, steps) {
  const refWords = significantWords(reference);
  if (!refWords.length || !steps?.length) return null;

  let best = null;
  let bestScore = 0;
  for (const step of steps) {
    const labelWords = significantWords(step.label || "");
    const score = refWords.filter((w) => labelWords.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = step;
    }
  }
  return bestScore > 0 ? best : null;
}

/**
 * Given a lowercase transcript from SpeechRecognition, return the matching
 * command:
 *  - a plain action string ("next", "repeat", "loop-on", ...) for fixed
 *    commands, or
 *  - { type: "goto-step", step } when the phrase seems to reference one of
 *    the recipe's steps by name (e.g. "play the mince onions step"), or
 *  - { type: "loop-step", step } for "loop <step name>" — jump to that step
 *    and turn loop mode on for it in one go, or
 *  - null if nothing recognized.
 *
 * Pass the recipe's `steps` array to enable step-name recognition; omit it
 * (or pass []) to only match the fixed command set.
 */
export function matchVoiceCommand(transcript, steps = []) {
  const text = transcript.toLowerCase().trim();

  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.action;
  }

  if (steps.length) {
    const loopStepMatch = text.match(LOOP_STEP_PATTERN);
    if (loopStepMatch) {
      const step = findMatchingStep(loopStepMatch[1], steps);
      if (step) return { type: "loop-step", step };
    }

    const referenceMatch = text.match(STEP_REFERENCE_PATTERN);
    const reference = referenceMatch ? referenceMatch[1] : text;
    const step = findMatchingStep(reference, steps);
    if (step) return { type: "goto-step", step };
  }

  return null;
}
