// Ordered most-specific-first: the first matching rule wins. "restart-video"
// and "continue-playing" must come before "next", since "continue" alone is
// a synonym for "next step" and would otherwise wrongly match phrases like
// "continue playing" first.
const RULES = [
  { action: "loop-off", test: /loop off|stop loop|stop looping|turn off (the )?loop|no loop/ },
  { action: "loop-on", test: /loop on|start loop|keep looping|loop this|turn on (the )?loop|repeat forever/ },
  { action: "half-speed", test: /half speed|1\/2 speed|slow motion/ },
  { action: "normal-speed", test: /normal speed|full speed|^normal$/ },
  { action: "show-ingredients", test: /show me (the )?ingredients( list)?|show (the )?ingredients( list)?|open (the )?ingredients( list)?/ },
  { action: "hide-ingredients", test: /hide (the )?ingredients( list)?|close (the )?ingredients( list)?|dismiss (the )?ingredients( list)?/ },
  { action: "scroll-down", test: /scroll down/ },
  { action: "scroll-up", test: /scroll up/ },
  { action: "scroll-top", test: /scroll to (the )?top/ },
  { action: "scroll-bottom", test: /scroll to (the )?bottom/ },
  { action: "first", test: /first step/ },
  { action: "repeat", test: /repeat|replay|again|restart (this|the) step/ },
  { action: "restart-video", test: /start over|from the beginning|restart (the )?(recipe|video)/ },
  { action: "continue-playing", test: /keep playing|play through|continue playing|just play/ },
  { action: "next", test: /next step|next|continue|move on|skip ahead/ },
  { action: "previous", test: /previous step|previous|go back|back up|last step/ },
  { action: "play", test: /^play$|resume|start video/ },
  { action: "pause", test: /^pause$|^stop$|stop video|hold on/ },
  // "mark done" / "mark it done" / "mark this step done" — no step name
  // given, so this marks whichever step is currently playing/active.
  // Checked here (fixed RULES, not the step-name patterns below) so it
  // wins before MARK_STEP_DONE_PATTERN ever gets a chance to mistake
  // "it"/"this step" for a step name to fuzzy-match against.
  { action: "mark-done", test: /^mark(?: it| this| this step| the current step)? done$/ },
  // "let's get cooking" / "no, let's just get cooking" / "start cooking" /
  // "skip" — dismiss the recipe page's welcome overlay
  // (components/RecipePlayer.jsx) without reviewing ingredients first.
  // The optional "just" covers the overlay button's own exact copy
  // ("No, let's just get cooking.") as well as the plainer original
  // phrasing. Bare "skip" is anchored (^skip$) so it can't swallow "skip
  // ahead" above, which already means "next". Reviewing ingredients from
  // the same overlay reuses the existing "show-ingredients" rule above
  // rather than a separate command.
  { action: "dismiss-welcome", test: /^skip$|let'?s (?:just )?get cooking|start cooking/ },
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

// "play the sear meat step at half speed" / "play sear meat at 1/2 speed" —
// jump to that step and play it once at half speed. Checked before the
// plain STEP_REFERENCE_PATTERN so the speed suffix doesn't just get
// swallowed as noise inside the step-name capture.
const PLAY_STEP_HALF_SPEED_PATTERN =
  /^play\s+(?:the\s+)?(.+?)(?:\s+step)?\s+at\s+(?:half|1\/2)\s+speed$/i;

// "loop the sear meat step at half speed" / "loop sear meat at 1/2 speed" —
// jump to that step, turn loop mode on, AND hold it at half speed across
// every repeat. Checked before the plain LOOP_STEP_PATTERN for the same
// reason as above.
const LOOP_STEP_HALF_SPEED_PATTERN =
  /^loop\s+(?:the\s+)?(.+?)(?:\s+step)?\s+at\s+(?:half|1\/2)\s+speed$/i;

// "mark chop garlic done" / "mark the chop garlic step done" — mark a
// specific step done by name. Checked after the plain "mark done" RULES
// entry above (which handles the no-name case) and before the generic
// STEP_REFERENCE_PATTERN fallback, so a named step here doesn't get
// mistaken for a "go to this step" request.
const MARK_STEP_DONE_PATTERN = /^mark\s+(?:the\s+)?(.+?)(?:\s+step)?\s+done$/i;

// "check off breadcrumbs" / "check breadcrumbs" / "got the eggs" — mark an
// ingredient checked by name.
const CHECK_INGREDIENT_PATTERN = /^(?:check off|check|got)\s+(?:the\s+)?(.+)$/i;

// "uncheck breadcrumbs" / "uncheck off breadcrumbs" / "unmark eggs" — mark
// an ingredient unchecked by name.
const UNCHECK_INGREDIENT_PATTERN = /^(?:uncheck off|uncheck|unmark)\s+(?:the\s+)?(.+)$/i;

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
 * Find the index of whichever string in `texts` shares the most significant
 * words with the given reference phrase (e.g. "prep breadcrumbs" against
 * step labels, or "eggs" against plain ingredient strings). Returns -1 if
 * nothing shares at least one meaningful word — callers should treat that
 * as "no good match, don't guess" rather than falling back to a weak one.
 */
function findBestMatchIndex(reference, texts) {
  const refWords = significantWords(reference);
  if (!refWords.length || !texts?.length) return -1;

  let bestIndex = -1;
  let bestScore = 0;
  texts.forEach((text, i) => {
    const words = significantWords(text || "");
    const score = refWords.filter((w) => words.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  });
  return bestScore > 0 ? bestIndex : -1;
}

/**
 * Find the step whose label best matches the given reference phrase. Thin
 * wrapper around findBestMatchIndex that returns the step itself (rather
 * than an index) to match how callers already use it.
 */
function findMatchingStep(reference, steps) {
  if (!steps?.length) return null;
  const index = findBestMatchIndex(
    reference,
    steps.map((s) => s.label || "")
  );
  return index >= 0 ? steps[index] : null;
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
 *  - { type: "play-step-half-speed", step } / { type: "loop-step-half-speed",
 *    step } for "play/loop <step name> at half speed" (or "at 1/2 speed") —
 *    same as goto-step/loop-step but also plays at 0.5x, or
 *  - { type: "check-ingredient", index } / { type: "uncheck-ingredient",
 *    index } for "check off <ingredient>" / "uncheck <ingredient>" style
 *    phrases, matched against the recipe's ingredients by name, or
 *  - { type: "mark-step-done", step } for "mark <step name> done" — the
 *    plain action string "mark-done" (no step name) covers marking
 *    whichever step is currently active instead, or
 *  - "dismiss-welcome" for "let's get cooking"/"start cooking"/"skip" —
 *    dismisses the recipe page's first-visit welcome overlay; reviewing
 *    ingredients from that same overlay reuses "show-ingredients" rather
 *    than a separate command, or
 *  - null if nothing recognized.
 *
 * Pass the recipe's `steps` array to enable step-name recognition, and its
 * `ingredients` array to enable check/uncheck-by-name recognition; omit
 * either (or pass []) to skip that part of matching.
 */
export function matchVoiceCommand(transcript, steps = [], ingredients = []) {
  const text = transcript.toLowerCase().trim();

  // Checked before the generic RULES below: a phrase like "play sear meat at
  // half speed" would otherwise get short-circuited by RULES' plain
  // "half speed" substring match before its step name ever gets a chance to
  // resolve against `steps`.
  if (steps.length) {
    const playHalfSpeedMatch = text.match(PLAY_STEP_HALF_SPEED_PATTERN);
    if (playHalfSpeedMatch) {
      const step = findMatchingStep(playHalfSpeedMatch[1], steps);
      if (step) return { type: "play-step-half-speed", step };
    }

    const loopHalfSpeedMatch = text.match(LOOP_STEP_HALF_SPEED_PATTERN);
    if (loopHalfSpeedMatch) {
      const step = findMatchingStep(loopHalfSpeedMatch[1], steps);
      if (step) return { type: "loop-step-half-speed", step };
    }
  }

  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.action;
  }

  // Checked before step matching: without this, an unrecognized phrase like
  // "got the eggs" would otherwise fall through to being guessed as a step
  // reference (steps often share ingredient words, e.g. an "Add eggs" step).
  if (ingredients.length) {
    const checkMatch = text.match(CHECK_INGREDIENT_PATTERN);
    if (checkMatch) {
      const index = findBestMatchIndex(checkMatch[1], ingredients);
      if (index >= 0) return { type: "check-ingredient", index };
    }

    const uncheckMatch = text.match(UNCHECK_INGREDIENT_PATTERN);
    if (uncheckMatch) {
      const index = findBestMatchIndex(uncheckMatch[1], ingredients);
      if (index >= 0) return { type: "uncheck-ingredient", index };
    }
  }

  if (steps.length) {
    const loopStepMatch = text.match(LOOP_STEP_PATTERN);
    if (loopStepMatch) {
      const step = findMatchingStep(loopStepMatch[1], steps);
      if (step) return { type: "loop-step", step };
    }

    const markStepDoneMatch = text.match(MARK_STEP_DONE_PATTERN);
    if (markStepDoneMatch) {
      const step = findMatchingStep(markStepDoneMatch[1], steps);
      if (step) return { type: "mark-step-done", step };
    }

    const referenceMatch = text.match(STEP_REFERENCE_PATTERN);
    const reference = referenceMatch ? referenceMatch[1] : text;
    const step = findMatchingStep(reference, steps);
    if (step) return { type: "goto-step", step };
  }

  return null;
}
