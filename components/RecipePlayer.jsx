"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import StepList from "@/components/StepList";
import WatchReadToggle from "@/components/WatchReadToggle";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { matchVoiceCommand } from "@/lib/voiceCommands";
import { playIngredientCheckedSound, playIngredientUncheckedSound } from "@/lib/sound";

// The "need to get" list is a single freeform editable text value (see
// needToGetText below), not a derived list — so checking/unchecking
// "Need to get" for a specific ingredient has to surgically add or
// remove just that ingredient's own line, by exact-text match, rather
// than regenerating the whole value and wiping out any manual edits.
// Entries are blocks separated by one or more blank lines (matching the
// existing blank-line-between-entries convention); a manually-typed
// multi-line note without a blank line inside it survives as one entry.
function parseIngredientEntries(text) {
  return text
    .split(/\n\s*\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function addIngredientLine(text, line) {
  const trimmedLine = line.trim();
  const entries = parseIngredientEntries(text);
  if (entries.includes(trimmedLine)) return text;
  entries.push(trimmedLine);
  return entries.join("\n\n");
}

function removeIngredientLine(text, line) {
  const trimmedLine = line.trim();
  return parseIngredientEntries(text)
    .filter((entry) => entry !== trimmedLine)
    .join("\n\n");
}

// Shared "voice input is scoped to this modal/panel only" gate, used by
// both the welcome overlay and the ingredients panel below — the exact
// same bug shape hit both: passing the full steps array let the general
// fuzzy step matcher fire underneath a modal that should own voice
// input exclusively (for the ingredients panel specifically, "I need
// eggs" could fuzzy-match a step whose title happens to share a word,
// e.g. "Hand mix ingredients," and start that step playing behind the
// panel). Resolves the transcript against a restricted steps/ingredients
// pair (so whichever fuzzy matching depends on either is disabled per
// caller's needs) and returns the raw action only if its type is in the
// caller's allowlist — everything else, including fixed RULES actions
// like "next" or "play" (which aren't steps/ingredients-gated and would
// otherwise leak through even with empty arrays), comes back as null.
function matchScopedVoiceCommand(transcript, { steps = [], ingredients = [], allow }) {
  const action = matchVoiceCommand(transcript, steps, ingredients);
  const type = action && typeof action === "object" ? action.type : action;
  return allow.has(type) ? action : null;
}

export default function RecipePlayer({ recipe, onRead }) {
  const steps = recipe.steps;
  const videoRef = useRef(null);
  // The two independently-scrollable regions, for voice-driven scrolling —
  // whichever is on-screen ("active") at the time depends on showIngredients.
  const stepsListRef = useRef(null);
  const ingredientsListRef = useRef(null);

  const [activeStepId, setActiveStepId] = useState(steps[0]?.id ?? null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [segmentEnded, setSegmentEnded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // Quick-glance ingredients checklist, slid up over the video on mobile —
  // doesn't pause playback or otherwise leave hands-free mode.
  const [showIngredients, setShowIngredients] = useState(false);
  // Per-ingredient status, keyed by its index in recipe.ingredients:
  // "have" (I have it — reviewed) or "need" (on the running "need to
  // get" list) or absent (unset). Replaces the earlier plain checkmark —
  // same session-only lifecycle as doneSteps below (resets on reload).
  const [ingredientStatus, setIngredientStatus] = useState(() => new Map());
  // "I need <word>" voice matches that tie between more than one real
  // ingredient (e.g. "garlic" against both "garlic" and "garlic powder")
  // surface a pick-one-or-more popup instead of guessing. Array of
  // candidate ingredient indices while it's showing, else null.
  const [ambiguousCandidates, setAmbiguousCandidates] = useState(null);
  const [ambiguousChecked, setAmbiguousChecked] = useState(() => new Set());
  // The "need to get" list itself — a single freeform editable text
  // value (not derived from ingredientStatus), so the user can type
  // notes, fix typos, or add items that were never in the ingredient
  // list at all. Checking/unchecking "Need to get" surgically adds or
  // removes that ingredient's own line (see addIngredientLine/
  // removeIngredientLine above) rather than regenerating this whole
  // value, so manual edits survive. Session-only, same lifecycle as
  // ingredientStatus below.
  const [needToGetText, setNeedToGetText] = useState("");
  // Brief confirmation after "Copy list" — auto-dismisses on its own.
  const [copyConfirmation, setCopyConfirmation] = useState(false);
  const copyConfirmationTimeoutRef = useRef(null);
  // Steps checked off via "mark done"/"mark [step] done" or the checkmark
  // in the steps list. Session-only, same lifecycle as loopEnabled above —
  // resets on reload, no localStorage.
  const [doneSteps, setDoneSteps] = useState(() => new Set());
  // First-visit welcome overlay — shown once per recipe per browser
  // session (sessionStorage, not localStorage), so it naturally resets
  // when the tab/browser closes but doesn't reappear on a same-session
  // reload or navigate-away-and-back. Starts false on both server and
  // client render to avoid a hydration mismatch; the effect below flips
  // it true right after mount, client-side only, where sessionStorage
  // actually exists.
  const [showWelcome, setShowWelcome] = useState(false);
  // false = "just play the whole video through" (the default on first load —
  // no stopping at step boundaries). true = "focused on one step" — entered
  // whenever you jump to a specific step by name, by list click, or via
  // Next/Previous/Repeat — at which point loop/stop-and-replay behavior
  // kicks in for that step.
  const [segmentMode, setSegmentMode] = useState(false);
  // Resuming with "play" right after a step ends (the Replay/Next choice
  // is showing) would otherwise re-trigger that same step's end-boundary
  // check on the very next timeupdate, since currentTime is already at/past
  // it — pausing again almost immediately. This flag means "keep playing
  // through subsequent step boundaries instead of pausing at each one,"
  // entered only via that specific resume (see handlePlay/handleTogglePlay
  // below) and cleared by any explicit step navigation (playStep) or by
  // turning looping on, both of which mean the user wants normal per-step
  // behavior again.
  const [continuousMode, setContinuousMode] = useState(false);
  // 1 (normal) or 0.5 (half speed). Only sticks around across repeats while
  // the current step is looping — any actual segment change (a different
  // step, or leaving segment mode) resets it, per the voice-command spec
  // below. Applied to the <video> element via the effect right after this.
  const [playbackRate, setPlaybackRate] = useState(1);
  // Whichever step's [start, end) range actually contains the playhead
  // right now, or null during a gap — before the first step starts, after
  // the last one ends, or any untagged space between two. Powers only
  // display concerns (the title overlay, the steps-list highlight/auto-
  // scroll) — deliberately kept separate from activeStepId, which tracks
  // the step the user last explicitly navigated to and legitimately keeps
  // pointing at it through a gap, since Next/Previous/Repeat still need a
  // sensible step to act relative to while just watching through one.
  const [currentStep, setCurrentStep] = useState(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const welcomeSeenKey = `recipe-welcome-seen:${recipe.slug}`;

  useEffect(() => {
    if (!window.sessionStorage.getItem(welcomeSeenKey)) {
      setShowWelcome(true);
    }
  }, [welcomeSeenKey]);

  // Either button (or voice equivalent) counts as "seen" — suppresses the
  // overlay for this recipe for the rest of the browser session.
  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    window.sessionStorage.setItem(welcomeSeenKey, "1");
  }, [welcomeSeenKey]);

  const handleWelcomeReviewIngredients = useCallback(() => {
    dismissWelcome();
    setShowIngredients(true);
  }, [dismissWelcome]);

  const activeIndex = useMemo(
    () => steps.findIndex((s) => s.id === activeStepId),
    [steps, activeStepId]
  );
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;

  const playStep = useCallback(
    (step, { rate } = {}) => {
      const video = videoRef.current;
      if (!video || !step) return;
      // Replaying the SAME step (e.g. the "repeat" command, or re-clicking
      // the step you're already on) isn't a segment change, so an active
      // half-speed loop shouldn't be reset just because of it — only an
      // actual jump to a different step resets the rate.
      const isSameStep = step.id === activeStepId;
      video.currentTime = step.start;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
      setActiveStepId(step.id);
      // Set eagerly rather than waiting for the next timeupdate — we just
      // moved the playhead to this step's own start, so it's unambiguously
      // "within range" immediately, and this keeps the overlay/highlight
      // from lagging a beat behind a click or voice command.
      setCurrentStep(step);
      setSegmentMode(true);
      setSegmentEnded(false);
      setShowIngredients(false);
      // Any explicit "go to this step" — including replaying the same one
      // — is a manual navigation, which per spec drops back to normal
      // pause-at-step-end behavior rather than continuing to play through.
      setContinuousMode(false);
      if (rate !== undefined) setPlaybackRate(rate);
      else if (!isSameStep) setPlaybackRate(1);
    },
    [activeStepId]
  );

  const goToIndex = useCallback(
    (index) => {
      if (index < 0 || index >= steps.length) return;
      playStep(steps[index]);
    },
    [steps, playStep]
  );

  const handleNext = useCallback(() => goToIndex(activeIndex + 1), [activeIndex, goToIndex]);
  const handlePrevious = useCallback(() => goToIndex(activeIndex - 1), [activeIndex, goToIndex]);
  const handleRepeat = useCallback(() => {
    if (activeStep) playStep(activeStep);
  }, [activeStep, playStep]);
  const handleFirst = useCallback(() => goToIndex(0), [goToIndex]);

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      // Resuming specifically from the step-end paused/choice state means
      // "keep going" rather than "resume this same step" — otherwise we'd
      // immediately re-hit the same end boundary and pause right back.
      if (segmentEnded) setContinuousMode(true);
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      setSegmentEnded(false);
      setShowIngredients(false);
    } else {
      // A manual pause mid-continuous-play doesn't cancel continuousMode —
      // saying/clicking "play" again should just resume it, not require
      // re-triggering.
      video.pause();
      setIsPlaying(false);
    }
  }, [segmentEnded]);

  const handlePause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    if (segmentEnded) setContinuousMode(true);
    videoRef.current
      ?.play()
      .then(() => setIsPlaying(true))
      .catch(() => {});
    setSegmentEnded(false);
    setShowIngredients(false);
  }, [segmentEnded]);

  const handleRestartVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setSegmentMode(false);
    video
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {});
    setSegmentEnded(false);
    setShowIngredients(false);
    setPlaybackRate(1);
    setContinuousMode(false);
  }, []);

  const handleContinuePlaying = useCallback(() => {
    setSegmentMode(false);
    videoRef.current
      ?.play()
      .then(() => setIsPlaying(true))
      .catch(() => {});
    setSegmentEnded(false);
    setShowIngredients(false);
    setPlaybackRate(1);
    setContinuousMode(false);
  }, []);

  // Click on "I have" — toggles. Decided from current state rather than
  // inside the setState updater, so the sound (a side effect) can't fire
  // twice under React Strict Mode's dev-only double-invocation of
  // updater functions (same reasoning as the old toggleIngredientChecked
  // this replaces).
  const setIngredientHave = useCallback(
    (index) => {
      const previousStatus = ingredientStatus.get(index);
      const willBeHave = previousStatus !== "have";
      setIngredientStatus((prev) => {
        const next = new Map(prev);
        if (willBeHave) next.set(index, "have");
        else next.delete(index);
        return next;
      });
      // Switching a "need to get" ingredient to "have" (or clearing it)
      // means it's no longer on the list — remove its line so the text
      // doesn't silently drift out of sync with the checkbox state.
      if (previousStatus === "need") {
        const ingredientText = recipe.ingredients[index];
        setNeedToGetText((prevText) => removeIngredientLine(prevText, ingredientText));
      }
      if (willBeHave) playIngredientCheckedSound();
      else playIngredientUncheckedSound();
    },
    [ingredientStatus, recipe.ingredients]
  );

  // Click on "Need to get" — also toggles (unlike the voice path below,
  // which explicitly sets — mirrors the mark-step-done/check-ingredient
  // pattern elsewhere in this file).
  const setIngredientNeed = useCallback(
    (index) => {
      const willBeNeed = ingredientStatus.get(index) !== "need";
      const ingredientText = recipe.ingredients[index];
      setIngredientStatus((prev) => {
        const next = new Map(prev);
        if (willBeNeed) next.set(index, "need");
        else next.delete(index);
        return next;
      });
      setNeedToGetText((prevText) =>
        willBeNeed
          ? addIngredientLine(prevText, ingredientText)
          : removeIngredientLine(prevText, ingredientText)
      );
    },
    [ingredientStatus, recipe.ingredients]
  );

  // Voice equivalents of the two ingredient actions above — extracted so
  // handleVoiceCommand below can call the exact same logic from both its
  // normal path and its ingredients-panel-scoped path (matchScopedVoiceCommand)
  // without duplicating the state-mutation details in two places.
  const handleCheckIngredientAction = useCallback(
    (index) => {
      // Repurposed for the "I have"/"Need to get" model: "check off
      // eggs"/"got the eggs" now sets the "have" status. Explicitly set
      // (not a toggle) — saying it twice shouldn't flip back to unset.
      // If it was on the "need to get" list, it isn't anymore — remove
      // its line so the text doesn't drift out of sync.
      const wasNeed = ingredientStatus.get(index) === "need";
      setIngredientStatus((prev) => new Map(prev).set(index, "have"));
      if (wasNeed) {
        const ingredientText = recipe.ingredients[index];
        setNeedToGetText((prevText) => removeIngredientLine(prevText, ingredientText));
      }
      playIngredientCheckedSound();
      setShowIngredients(true);
    },
    [ingredientStatus, recipe.ingredients]
  );

  const handleUncheckIngredientAction = useCallback(
    (index) => {
      // "uncheck eggs"/"unmark eggs" clears the status entirely,
      // whichever it was — the voice-level inverse of "check off." Same
      // need-to-get-list cleanup as check-ingredient above.
      const wasNeed = ingredientStatus.get(index) === "need";
      setIngredientStatus((prev) => {
        const next = new Map(prev);
        next.delete(index);
        return next;
      });
      if (wasNeed) {
        const ingredientText = recipe.ingredients[index];
        setNeedToGetText((prevText) => removeIngredientLine(prevText, ingredientText));
      }
      playIngredientUncheckedSound();
      setShowIngredients(true);
    },
    [ingredientStatus, recipe.ingredients]
  );

  const handleNeedIngredientAction = useCallback(
    (index) => {
      // "I need breadcrumbs" — exactly one ingredient matched.
      // Explicitly set (not toggle), same reasoning as check-ingredient
      // above.
      const ingredientText = recipe.ingredients[index];
      setIngredientStatus((prev) => new Map(prev).set(index, "need"));
      setNeedToGetText((prevText) => addIngredientLine(prevText, ingredientText));
      setShowIngredients(true);
    },
    [recipe.ingredients]
  );

  const handleNeedIngredientAmbiguousAction = useCallback((indices) => {
    // More than one ingredient tied for the best fuzzy match (e.g.
    // "garlic" against both "garlic" and "garlic powder") — ask rather
    // than guess.
    setAmbiguousCandidates(indices);
    setAmbiguousChecked(new Set());
    setShowIngredients(true);
  }, []);

  const toggleAmbiguousChecked = useCallback((index) => {
    setAmbiguousChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Commits every checked candidate to the "need to get" list in one go
  // — no partial commit without this explicit confirmation.
  const confirmAmbiguousAddToList = useCallback(() => {
    setIngredientStatus((prev) => {
      const next = new Map(prev);
      ambiguousChecked.forEach((index) => next.set(index, "need"));
      return next;
    });
    setNeedToGetText((prevText) => {
      let text = prevText;
      ambiguousChecked.forEach((index) => {
        text = addIngredientLine(text, recipe.ingredients[index]);
      });
      return text;
    });
    setAmbiguousCandidates(null);
    setAmbiguousChecked(new Set());
  }, [ambiguousChecked, recipe.ingredients]);

  const cancelAmbiguous = useCallback(() => {
    setAmbiguousCandidates(null);
    setAmbiguousChecked(new Set());
  }, []);

  const handleCopyList = useCallback(() => {
    // Copies exactly what's in the box — including any manual edits —
    // not a regenerated version.
    navigator.clipboard
      .writeText(needToGetText)
      .then(() => {
        setCopyConfirmation(true);
        if (copyConfirmationTimeoutRef.current) {
          clearTimeout(copyConfirmationTimeoutRef.current);
        }
        copyConfirmationTimeoutRef.current = setTimeout(
          () => setCopyConfirmation(false),
          4000
        );
      })
      .catch(() => {
        // Clipboard access can fail (permissions, insecure context) —
        // the list stays visible and readable either way, so this just
        // silently skips the confirmation rather than showing an error.
      });
  }, [needToGetText]);

  const handleDoneWithIngredients = useCallback(() => {
    setShowIngredients(false);
  }, []);

  // Click on the checkmark in the steps list — toggles, unlike the voice
  // commands below which explicitly set (mirrors check/uncheck-ingredient:
  // voice sets a specific state, direct UI interaction toggles).
  const toggleStepDone = useCallback((stepId) => {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  // Downward-swipe-to-dismiss on the ingredients panel. Tracked in refs
  // (not state) since touchmove fires continuously and shouldn't trigger a
  // re-render — only touchend acts on the accumulated drag distance.
  const ingredientsTouchStartY = useRef(null);
  const ingredientsTouchDeltaY = useRef(0);

  const handleIngredientsTouchStart = useCallback((e) => {
    ingredientsTouchStartY.current = e.touches[0].clientY;
    ingredientsTouchDeltaY.current = 0;
  }, []);

  const handleIngredientsTouchMove = useCallback((e) => {
    if (ingredientsTouchStartY.current == null) return;
    ingredientsTouchDeltaY.current = e.touches[0].clientY - ingredientsTouchStartY.current;
  }, []);

  const handleIngredientsTouchEnd = useCallback(() => {
    if (ingredientsTouchDeltaY.current > 50) {
      setShowIngredients(false);
    }
    ingredientsTouchStartY.current = null;
    ingredientsTouchDeltaY.current = 0;
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Whichever step's range the playhead is actually inside right now, or
    // undefined in a gap. Computed once here (previously duplicated in the
    // two branches below) and always drives currentStep — regardless of
    // mode, so the overlay/highlight correctly goes blank in a gap even
    // during segment-focused playback, not just continuous/continuousMode.
    const withinStep = steps.find(
      (s) => video.currentTime >= s.start && video.currentTime < s.end
    );
    setCurrentStep(withinStep ?? null);

    if (!segmentMode) {
      // Continuous playback: just keep the step list highlight following
      // the playhead — no stopping or looping at step boundaries. Crossing
      // into a new step here still counts as a "segment change" for speed
      // purposes, so half speed doesn't silently carry across the whole
      // video.
      if (withinStep && withinStep.id !== activeStepId) {
        setActiveStepId(withinStep.id);
        setPlaybackRate(1);
      }
      return;
    }

    if (!activeStep) return;

    if (continuousMode) {
      // Resumed via "play" from a step-end pause — keep playing through
      // subsequent step boundaries instead of re-pausing at each one, but
      // still follow the playhead so the active step highlight advances,
      // same as plain (non-segment) continuous playback does above.
      if (withinStep && withinStep.id !== activeStepId) {
        setActiveStepId(withinStep.id);
        setPlaybackRate(1);
      }
      return;
    }

    if (video.currentTime >= activeStep.end - 0.12) {
      if (loopEnabled) {
        video.currentTime = activeStep.start;
      } else {
        video.pause();
        setIsPlaying(false);
        setSegmentEnded(true);
        setPlaybackRate(1);
      }
    }
  }, [segmentMode, continuousMode, steps, activeStepId, activeStep, loopEnabled]);

  const handleVoiceCommand = useCallback(
    (transcript) => {
      // While the welcome overlay is up, voice routes ONLY to its own two
      // choices — dismiss, or review ingredients — never to step/playback
      // commands. This isn't a keyword-level patch: passing empty
      // steps/ingredients disables ALL fuzzy step-name and ingredient
      // matching (not just the "ingredients" word colliding with a step
      // titled "hand mix ingredients," which is what surfaced this), and
      // returning immediately after means no other fixed action (next,
      // play, loop-on, ...) can reach the switch below and act on the
      // video hidden behind the overlay either.
      if (showWelcome) {
        const overlayAction = matchScopedVoiceCommand(transcript, {
          allow: new Set(["dismiss-welcome", "show-ingredients"]),
        });
        if (overlayAction === "dismiss-welcome") {
          dismissWelcome();
        } else if (overlayAction === "show-ingredients") {
          dismissWelcome();
          setShowIngredients(true);
        }
        return;
      }

      // While the ambiguous-ingredient-match popup is up, voice has no
      // defined way to interact with its checkboxes (click-only, per
      // spec) — block everything else too, same modal-scoping lesson as
      // the welcome overlay above, so a stray "next step" etc. can't act
      // on the video hidden behind it.
      if (ambiguousCandidates) {
        return;
      }

      // While the ingredients panel is open, voice routes ONLY to its own
      // intents — "I need"/"I have" per ingredient, and "done" — never to
      // general step/playback commands. Same shape as the welcome-overlay
      // bug above: a phrase like "I need eggs" could otherwise still
      // fuzzy-match a step whose title happens to share a word (e.g. one
      // titled "Hand mix ingredients") via the general matcher and start
      // it playing behind the panel. matchScopedVoiceCommand blocks that
      // (empty steps disables step fuzzy-matching) AND blocks fixed RULES
      // actions like "next"/"play" (which aren't steps-gated and would
      // otherwise leak through even with empty steps) via the allowlist.
      if (showIngredients) {
        const ingredientsAction = matchScopedVoiceCommand(transcript, {
          ingredients: recipe.ingredients,
          allow: new Set([
            "check-ingredient",
            "uncheck-ingredient",
            "need-ingredient",
            "need-ingredient-ambiguous",
            "hide-ingredients",
          ]),
        });
        if (ingredientsAction && typeof ingredientsAction === "object") {
          switch (ingredientsAction.type) {
            case "check-ingredient":
              handleCheckIngredientAction(ingredientsAction.index);
              break;
            case "uncheck-ingredient":
              handleUncheckIngredientAction(ingredientsAction.index);
              break;
            case "need-ingredient":
              handleNeedIngredientAction(ingredientsAction.index);
              break;
            case "need-ingredient-ambiguous":
              handleNeedIngredientAmbiguousAction(ingredientsAction.indices);
              break;
          }
        } else if (ingredientsAction === "hide-ingredients") {
          setShowIngredients(false);
        }
        return;
      }

      const action = matchVoiceCommand(transcript, steps, recipe.ingredients);

      if (action && typeof action === "object" && action.type === "goto-step") {
        playStep(action.step);
        return;
      }
      if (action && typeof action === "object" && action.type === "loop-step") {
        setLoopEnabled(true);
        playStep(action.step);
        return;
      }
      if (action && typeof action === "object" && action.type === "play-step-half-speed") {
        playStep(action.step, { rate: 0.5 });
        return;
      }
      if (action && typeof action === "object" && action.type === "loop-step-half-speed") {
        setLoopEnabled(true);
        playStep(action.step, { rate: 0.5 });
        return;
      }
      if (action && typeof action === "object" && action.type === "check-ingredient") {
        handleCheckIngredientAction(action.index);
        return;
      }
      if (action && typeof action === "object" && action.type === "uncheck-ingredient") {
        handleUncheckIngredientAction(action.index);
        return;
      }
      if (action && typeof action === "object" && action.type === "need-ingredient") {
        handleNeedIngredientAction(action.index);
        return;
      }
      if (action && typeof action === "object" && action.type === "need-ingredient-ambiguous") {
        handleNeedIngredientAmbiguousAction(action.indices);
        return;
      }
      if (action && typeof action === "object" && action.type === "mark-step-done") {
        // Explicitly set (not a toggle) — saying "mark chop garlic done"
        // when it's already done shouldn't accidentally un-mark it.
        setDoneSteps((prev) => new Set(prev).add(action.step.id));
        return;
      }

      switch (action) {
        case "next":
          handleNext();
          break;
        case "previous":
          handlePrevious();
          break;
        case "repeat":
          handleRepeat();
          break;
        case "first":
          handleFirst();
          break;
        case "restart-video":
          handleRestartVideo();
          break;
        case "continue-playing":
          handleContinuePlaying();
          break;
        case "loop-on":
          setLoopEnabled(true);
          setSegmentMode(true);
          // Otherwise a stale continuousMode from a prior "keep playing
          // through" resume would skip the loop-boundary check entirely
          // below, silently ignoring this.
          setContinuousMode(false);
          break;
        case "loop-off":
          setLoopEnabled(false);
          setPlaybackRate(1);
          break;
        case "play":
          handlePlay();
          break;
        case "pause":
          handlePause();
          break;
        case "half-speed":
          setPlaybackRate(0.5);
          break;
        case "normal-speed":
          setPlaybackRate(1);
          break;
        case "show-ingredients":
          setShowIngredients(true);
          break;
        case "hide-ingredients":
          setShowIngredients(false);
          break;
        case "mark-done": {
          // No step name given — mark whichever step is currently
          // playing/active. Same fallback the steps-list highlight uses:
          // currentStep (the step under the playhead right now) when
          // available, else activeStep (the last step explicitly
          // navigated to), for a sensible target even during a gap.
          const target = currentStep ?? activeStep;
          if (target) setDoneSteps((prev) => new Set(prev).add(target.id));
          break;
        }
        // showIngredients is always false by this point — the panel-open
        // case returns early above — so these always target the steps
        // list, never the video-overlay ingredients panel.
        case "scroll-down": {
          const el = stepsListRef.current;
          el?.scrollBy({ top: el.clientHeight, behavior: "smooth" });
          break;
        }
        case "scroll-up": {
          const el = stepsListRef.current;
          el?.scrollBy({ top: -el.clientHeight, behavior: "smooth" });
          break;
        }
        case "scroll-top": {
          const el = stepsListRef.current;
          el?.scrollTo({ top: 0, behavior: "smooth" });
          break;
        }
        case "scroll-bottom": {
          const el = stepsListRef.current;
          el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          break;
        }
        default:
          break;
      }
    },
    [
      steps,
      recipe.ingredients,
      showIngredients,
      showWelcome,
      dismissWelcome,
      ambiguousCandidates,
      handleCheckIngredientAction,
      handleUncheckIngredientAction,
      handleNeedIngredientAction,
      handleNeedIngredientAmbiguousAction,
      currentStep,
      activeStep,
      playStep,
      handleNext,
      handlePrevious,
      handleRepeat,
      handleFirst,
      handleRestartVideo,
      handleContinuePlaying,
      handlePlay,
      handlePause,
    ]
  );

  const voice = useVoiceCommands(handleVoiceCommand);
  // Draws attention to the mic toggle while the welcome overlay is up.
  // Stops the moment the mic is turned on (voice.listening) or the
  // overlay is dismissed either way (showWelcome), by construction —
  // both are direct inputs to this, not something separately reset.
  const micShouldPulse = showWelcome && !voice.listening;

  const loopCheckbox = (
    <input
      type="checkbox"
      checked={loopEnabled}
      onChange={(e) => {
        const checked = e.target.checked;
        setLoopEnabled(checked);
        // Checking this while just watching continuously should
        // immediately start looping the step you're currently in,
        // not silently do nothing until you also click a step. Also
        // cancels continuousMode — otherwise a stale "keep playing
        // through" resume would skip the loop-boundary check entirely.
        if (checked) {
          setSegmentMode(true);
          setContinuousMode(false);
        }
        // Unchecking is the manual equivalent of "loop off" — same reset.
        else setPlaybackRate(1);
      }}
      className="accent-brand"
    />
  );

  // Mobile step controls (Repeat, Loop this step, Ingredients) — shared
  // between their current, reachable position (between the video and the
  // scrollable steps list) and an invisible same-size placeholder left
  // behind at the bottom bar's original spot, so that reserved space stays
  // put rather than collapsing. Same reuse pattern as loopCheckbox above:
  // one element, mounted in two places, always in sync.
  const stepControlsRow = (
    <div className="flex items-center justify-center gap-4 text-xs text-muted">
      <button onClick={handleRepeat} className="flex items-center gap-1">
        ↻ Repeat
      </button>
      <label className="flex items-center gap-1.5">
        {loopCheckbox}
        Loop this step
      </label>
      {recipe.ingredients?.length > 0 && (
        <button
          onClick={() => setShowIngredients((v) => !v)}
          className="flex items-center gap-1"
        >
          🧾 Ingredients
        </button>
      )}
    </div>
  );

  // Replaces Repeat/Loop/Ingredients (stepControlsRow, and their desktop
  // equivalents below) while the ingredients panel is open — none of
  // those apply while reviewing ingredients, and this explains where
  // "Need to get" picks actually end up instead.
  const ingredientsActiveNotice = (
    <div className="rounded-lg bg-gray-700 px-3 py-2.5 text-center text-sm font-bold leading-snug text-white">
      <p>Anything you need will be added to the list below.</p>
      <p>You can then copy it when done.</p>
    </div>
  );

  return (
    // Below md: a full-viewport (h-dvh) stack that takes over the screen —
    // video / scrollable steps / control bar — so only the steps list
    // scrolls, not the page. h-dvh + overflow-hidden (rather than a fixed
    // position) is what actually holds this to the viewport reliably under
    // iOS Safari's dynamic toolbar. At md and up this reverts to the
    // original static, side-by-side grid layout.
    <div className="flex h-dvh flex-col overflow-hidden bg-cream md:mx-auto md:block md:h-auto md:max-w-5xl md:overflow-visible md:px-4 md:py-6">
      {/* Title row — md and up only; on mobile the title is overlaid on the video instead. */}
      <div className="hidden md:mb-4 md:flex md:items-start md:justify-between md:gap-3">
        <div>
          <p className="eyebrow text-[11px]">
            {recipe.category}
          </p>
          <h1 className="text-2xl font-medium text-ink">{recipe.title}</h1>
          {recipe.description && (
            <p className="mt-1 text-sm text-muted">{recipe.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <WatchReadToggle mode="watch" onWatch={() => {}} onRead={onRead} />
          <Link
            href={`/admin/edit/${recipe.slug}`}
            className="shrink-0 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:border-brand/40 hover:text-ink"
          >
            ✏️ Edit chapters
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:grid md:flex-none md:grid-cols-3 md:gap-6">
        {/* Video section — 2/3 of the viewport height on mobile. */}
        <div className="flex min-h-0 flex-[2] flex-col md:col-span-2 md:block md:flex-none">
          <div className="relative min-h-0 flex-1 overflow-hidden bg-black shadow md:flex md:h-auto md:flex-none md:items-center md:justify-center md:rounded-xl">
            {/* Mobile-only title/category overlay, anchored to the top edge
                of the video instead of centered like the step-finished
                overlay below — small text, non-blocking of the frame. The
                site header is hidden on this page below md, so this also
                carries a back link home. */}
            <div className="absolute inset-x-0 top-0 z-10 flex items-start gap-2 bg-gradient-to-b from-black/70 via-black/20 to-transparent px-3 pb-6 pt-2.5 md:hidden">
              <Link
                href="/"
                aria-label="Back to recipes"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/30 text-white"
              >
                ←
              </Link>
              <div className="pointer-events-none min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-white/80">
                  {recipe.category}
                </p>
                <h1 className="truncate text-sm font-medium text-white">{recipe.title}</h1>
              </div>
              <WatchReadToggle mode="watch" onWatch={() => {}} onRead={onRead} />
            </div>

            <video
              ref={videoRef}
              // Mobile: full-bleed, object-cover crops to fill the frame —
              // a deliberate, different choice for the locked full-screen
              // phone view. Desktop/tablet: the video isn't forced into a
              // 16:9 box (imported recipes can be portrait or any other
              // shape) — it renders at its own aspect ratio, capped by the
              // column's width and a 70vh height, with object-contain so
              // the full frame is always visible. The wrapper's black
              // background shows through as letterboxing wherever the
              // video doesn't fill that box.
              className="h-full w-full object-cover md:h-auto md:w-auto md:max-h-[70vh] md:max-w-full md:object-contain"
              src={recipe.video}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              playsInline
            />
            {/* First-visit welcome overlay — sits in front of everything
                else in the video area (z-30, above the z-20 ingredients
                panel) until dismissed via either button or its voice
                equivalents. Doesn't touch playback at all: dismissing
                just reveals the normal, not-yet-started player. */}
            {showWelcome && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Welcome"
                className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/80 px-6 text-center text-white"
              >
                <p className="text-lg font-semibold">
                  Welcome to {recipe.title}! Shall we review the ingredients
                  needed first?
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={dismissWelcome}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                  >
                    No, let&apos;s just get cooking.
                  </button>
                  {recipe.ingredients?.length > 0 && (
                    <button
                      onClick={handleWelcomeReviewIngredients}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-brand/10"
                    >
                      Review ingredients
                    </button>
                  )}
                </div>
                {/* Handwritten-note styling (font-handwritten, see
                    app/layout.js/globals.css) deliberately sets this apart
                    from standard UI copy above — a little aside, not
                    another instruction. */}
                <p className="font-handwritten text-2xl leading-snug text-white/90">
                  Tip: you can turn on the mic and just answer me.
                </p>
                <button
                  onClick={voice.toggle}
                  disabled={!voice.supported}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40 ${
                    voice.listening ? "bg-red-600" : "bg-brand hover:bg-brand-dark"
                  } ${micShouldPulse ? "mic-orange-pulse" : ""}`}
                  title={voice.supported ? "Toggle voice control" : "Voice control isn't supported in this browser"}
                >
                  🎙️ {voice.listening ? "Listening…" : "Turn on mic"}
                </button>
              </div>
            )}
            {/* Ambiguous "I need <word>" voice match — more than one real
                ingredient tied for the best fuzzy match (e.g. "garlic"
                against both "garlic" and "garlic powder"), so this asks
                rather than guessing. z-40, above the welcome overlay's
                z-30 — the two can't actually coexist in practice, but
                this stays on top if that ever changes. Click-only (see
                the voice-routing gate above); multi-select since someone
                might genuinely need more than one candidate. */}
            {ambiguousCandidates && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Which ingredient did you mean?"
                className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center text-white"
              >
                <p className="text-base font-semibold">Which one did you mean?</p>
                <ul className="w-full max-w-xs space-y-2 text-left">
                  {ambiguousCandidates.map((index) => (
                    <li key={index}>
                      <label className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={ambiguousChecked.has(index)}
                          onChange={() => toggleAmbiguousChecked(index)}
                          className="accent-brand"
                        />
                        <span className="text-sm text-white">{recipe.ingredients[index]}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <button
                    onClick={cancelAmbiguous}
                    className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAmbiguousAddToList}
                    disabled={ambiguousChecked.size === 0}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
                  >
                    Add to list
                  </button>
                </div>
              </div>
            )}
            {/* Current-step title — driven by currentStep, which is null
                whenever the playhead isn't actually within any step's
                range (before the first step, after the last, or a gap
                between two), so this hides itself in those spots rather
                than sticking on a stale label. White/75% background with
                dark text (rather than the reverse) so it reads clearly
                over any video frame. */}
            {currentStep && (
              <div className="absolute bottom-3 left-3 z-10 max-w-[75%] truncate rounded-full bg-white/75 px-3 py-1 text-left text-lg font-bold text-ink">
                {currentStep.label}
              </div>
            )}
            {playbackRate !== 1 && (
              <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                0.5x
              </div>
            )}
            {segmentEnded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
                <p className="text-sm">Step finished</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleRepeat}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-brand/10"
                  >
                    ↻ Replay step
                  </button>
                  {activeIndex < steps.length - 1 && (
                    <button
                      onClick={handleNext}
                      className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                    >
                      Next step →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick-glance ingredients checklist — slides up over the video
                without pausing playback or otherwise leaving hands-free
                mode. The swipe-to-dismiss touch handlers below are inert on
                desktop (no touch events fire), where the ✕ button is the
                close affordance instead. */}
            {recipe.ingredients?.length > 0 && (
              <div
                ref={ingredientsListRef}
                onTouchStart={handleIngredientsTouchStart}
                onTouchMove={handleIngredientsTouchMove}
                onTouchEnd={handleIngredientsTouchEnd}
                className={`absolute inset-x-0 bottom-0 z-20 max-h-[70%] overflow-y-auto rounded-t-2xl bg-cream p-4 shadow-xl transition-transform duration-300 ${
                  showIngredients ? "translate-y-0" : "pointer-events-none translate-y-full"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="eyebrow text-[11px]">Ingredients</h2>
                  <button
                    onClick={() => setShowIngredients(false)}
                    aria-label="Close ingredients"
                    className="text-muted"
                  >
                    ✕
                  </button>
                </div>
                {/* Same grid-template-columns literal on the header and
                    every row below is what keeps the two checkbox columns
                    aligned down the whole list — a fixed-width column
                    (not "auto") guarantees the header and every row agree
                    on width regardless of that row's own content, and
                    "items-start" plus the text column being its own grid
                    cell is what keeps a wrapped second line under the
                    first line's text rather than sliding under a
                    checkbox. Checkboxes lead (left), text follows. */}
                <div className="grid grid-cols-[4.5rem_4.5rem_1fr] items-center gap-x-3 pb-1">
                  <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted">
                    I have
                  </span>
                  <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted">
                    Need to get
                  </span>
                  <span />
                </div>
                <ul className="space-y-2 text-sm">
                  {recipe.ingredients.map((ingredient, i) => {
                    const status = ingredientStatus.get(i);
                    return (
                      <li
                        key={i}
                        className="grid grid-cols-[4.5rem_4.5rem_1fr] items-start gap-x-3 gap-y-1"
                      >
                        <span className="flex justify-center pt-0.5">
                          <input
                            type="checkbox"
                            checked={status === "have"}
                            onChange={() => setIngredientHave(i)}
                            aria-label={`I have ${ingredient}`}
                            className="accent-brand"
                          />
                        </span>
                        <span className="flex justify-center pt-0.5">
                          <input
                            type="checkbox"
                            checked={status === "need"}
                            onChange={() => setIngredientNeed(i)}
                            aria-label={`Need to get ${ingredient}`}
                            className="accent-brand"
                          />
                        </span>
                        <span className={status === "have" ? "text-muted line-through" : "text-ink"}>
                          {ingredient}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Inline controls row + voice hints — md and up only; mobile has
              its own fixed bottom control bar instead. */}
          <div className="hidden md:block">
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Previous/Play/Repeat/Next/Loop/Ingredients don't apply
                  while reviewing ingredients — replaced with Copy
                  list/Done, the same relocation the mobile bottom bar
                  gets below. The mic button stays in place either way,
                  so voice keeps working from the same spot. */}
              {showIngredients ? (
                <>
                  <button
                    onClick={handleCopyList}
                    disabled={!needToGetText.trim()}
                    className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:border-brand/40 hover:text-ink disabled:opacity-40"
                  >
                    📋 Copy list
                  </button>
                  <button
                    onClick={handleDoneWithIngredients}
                    className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handlePrevious}
                    disabled={activeIndex <= 0}
                    className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:border-brand/40 hover:text-ink disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={handleTogglePlay}
                    className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    onClick={handleRepeat}
                    className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:border-brand/40 hover:text-ink"
                  >
                    ↻ Repeat step
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={activeIndex >= steps.length - 1}
                    className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:border-brand/40 hover:text-ink disabled:opacity-40"
                  >
                    Next →
                  </button>
                  <label className="ml-1 flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-muted">
                    {loopCheckbox}
                    Loop this step
                  </label>
                  {recipe.ingredients?.length > 0 && (
                    <button
                      onClick={() => setShowIngredients((v) => !v)}
                      className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:border-brand/40 hover:text-ink"
                    >
                      🧾 Ingredients
                    </button>
                  )}
                </>
              )}

              <button
                onClick={voice.toggle}
                disabled={!voice.supported}
                className={`ml-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-40 ${
                  voice.listening ? "bg-red-600" : "bg-brand hover:bg-brand-dark"
                } ${micShouldPulse ? "mic-orange-pulse" : ""}`}
                title={voice.supported ? "Toggle voice control" : "Voice control isn't supported in this browser"}
              >
                🎙️ {voice.listening ? "Listening…" : "Voice control"}
              </button>
            </div>

            {showIngredients && (
              <>
                <div className="mt-3">{ingredientsActiveNotice}</div>
                {copyConfirmation && (
                  <p role="status" className="mt-2 text-xs text-brand-dark">
                    Your list is copied. You can now paste it into a text,
                    notes, or elsewhere.
                  </p>
                )}
              </>
            )}

            {!voice.supported && (
              <p className="mt-2 text-xs text-muted">
                Voice control needs a browser with speech recognition support
                (Chrome or Edge work best). It isn&apos;t available here.
              </p>
            )}
            {voice.supported && voice.lastHeard && (
              <p className="mt-2 text-xs text-muted">
                Heard: &ldquo;{voice.lastHeard}&rdquo;
              </p>
            )}
            <p className="mt-1 text-xs text-muted">
              Try saying: &ldquo;next step&rdquo;, &ldquo;repeat this
              step&rdquo;, &ldquo;loop on&rdquo;, &ldquo;loop off&rdquo;,
              &ldquo;previous step&rdquo;, &ldquo;play&rdquo;,
              &ldquo;pause&rdquo;/&ldquo;stop&rdquo;, &ldquo;keep
              playing&rdquo;, &ldquo;start from the beginning&rdquo;,
              &ldquo;half speed&rdquo;/&ldquo;slow motion&rdquo;,
              &ldquo;normal speed&rdquo;, &ldquo;mark done&rdquo; — or
              reference a step by name, like
              &ldquo;play {steps[0]?.label?.toLowerCase()}&rdquo; or
              &ldquo;loop {steps[0]?.label?.toLowerCase()}&rdquo; (jumps
              there and keeps repeating it until you say &ldquo;stop&rdquo;
              or ask for another step), &ldquo;mark {steps[0]?.label?.toLowerCase()}{" "}
              done&rdquo;, or add &ldquo;at half speed&rdquo; to either.
            </p>
          </div>
        </div>

        {/* Repeat / Loop this step / Ingredients — mobile only, sitting
            right between the video and the scrollable steps list instead
            of the very bottom of the screen, which was too far from a
            resting thumb to reach comfortably. Desktop already has its own
            repeat/loop controls in the inline row above (no separate
            ingredients toggle there), so this is md:hidden. */}
        <div className="shrink-0 border-y border-ink/10 bg-white px-3 py-2 md:hidden">
          {showIngredients ? ingredientsActiveNotice : stepControlsRow}
        </div>

        {/* Bottom third — steps list + control bar grouped together so they
            share the remaining 1/3 of viewport height on mobile. At md and
            up this wrapper carries no layout of its own; the steps list
            reverts to being a normal 3rd grid column and the control bar
            (md:hidden) takes no space. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            ref={stepsListRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 md:flex-none md:overflow-visible md:px-0 md:pt-0"
          >
            {/* This area doubles as the "need to get" view while the
                ingredients panel is open — same ref, same voice-driven
                scroll target (see scroll-up/down/top/bottom above),
                just different content depending on showIngredients. The
                white note-card (need-to-get text) gets its own bounded,
                independently-scrollable height (flex-1 on mobile so it
                fills whatever room is left below the heading; a fixed
                md:h-96 on desktop) rather than growing this whole area
                taller as the list gets longer — Copy/Done/mic now live
                in the static bottom bar below instead, not inside this
                scrollable region, so they're always reachable without
                scrolling past a long list first. */}
            {showIngredients ? (
              <div className="flex h-full flex-col md:block md:h-auto">
                <h2 className="eyebrow heading-rule mb-4 hidden text-[11px] md:inline-block">
                  Need to get
                </h2>
                {/* White note-card sitting on the page's cream background
                    — only the actual list text lives on white. Genuinely
                    editable: a plain textarea bound directly to
                    needToGetText, so typing, fixing typos, adding your
                    own items, or removing lines all just work like any
                    normal text box. Checking/unchecking "Need to get" on
                    a row surgically edits this same value (see
                    addIngredientLine/removeIngredientLine) rather than
                    overwriting it, so manual edits here survive a voice
                    or click toggle. */}
                <div className="flex min-h-0 flex-1 flex-col rounded-xl bg-white p-4 shadow-sm md:h-96 md:flex-none">
                  <textarea
                    value={needToGetText}
                    onChange={(e) => setNeedToGetText(e.target.value)}
                    placeholder={
                      'Nothing on your list yet — mark an ingredient "Need to get," or just type your own here.'
                    }
                    className="min-h-0 flex-1 resize-none bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="eyebrow heading-rule mb-4 hidden text-[11px] md:inline-block">
                  Steps
                </h2>
                {/* currentStep (not activeStepId) drives the highlight/auto-
                    scroll — null in a gap, which StepList already handles by
                    just not matching any item, no highlight, no scroll. */}
                <StepList
                  steps={steps}
                  activeStepId={currentStep?.id ?? null}
                  onSelect={playStep}
                  doneSteps={doneSteps}
                  onToggleDone={toggleStepDone}
                />
              </>
            )}
          </div>

          {/* Mobile-only control bar, sitting right below the steps list —
              padded for the iOS home-indicator safe area. While the
              ingredients panel is open, the normal playback controls
              (back/Play/forward) don't apply, so this becomes a static
              Copy/Done/mic row instead — the same static-bottom-area
              relocation the mic button gets on desktop above, rather
              than leaving it stranded alone among controls that no
              longer make sense. */}
          <div className="shrink-0 border-t border-ink/10 bg-white pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:hidden">
            {showIngredients ? (
              <div className="px-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyList}
                    disabled={!needToGetText.trim()}
                    className="flex-1 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-muted disabled:opacity-40"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={handleDoneWithIngredients}
                    className="flex-1 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                  >
                    Done
                  </button>
                  <button
                    onClick={voice.toggle}
                    disabled={!voice.supported}
                    aria-label="Toggle voice control"
                    className={`rounded-full px-3 py-2 text-sm font-medium text-white disabled:opacity-40 ${
                      voice.listening ? "bg-red-600" : "bg-brand"
                    } ${micShouldPulse ? "mic-orange-pulse" : ""}`}
                  >
                    🎙️
                  </button>
                </div>
                {copyConfirmation && (
                  <p role="status" className="mt-1.5 text-center text-xs text-brand-dark">
                    Your list is copied. You can now paste it into a text,
                    notes, or elsewhere.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3">
                <button
                  onClick={handlePrevious}
                  disabled={activeIndex <= 0}
                  aria-label="Previous step"
                  className="rounded-full border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-muted disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  onClick={handleTogglePlay}
                  className="flex-1 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  onClick={handleNext}
                  disabled={activeIndex >= steps.length - 1}
                  aria-label="Next step"
                  className="rounded-full border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-muted disabled:opacity-40"
                >
                  →
                </button>
                <button
                  onClick={voice.toggle}
                  disabled={!voice.supported}
                  aria-label="Toggle voice control"
                  className={`rounded-full px-3 py-2 text-sm font-medium text-white disabled:opacity-40 ${
                    voice.listening ? "bg-red-600" : "bg-brand"
                  } ${micShouldPulse ? "mic-orange-pulse" : ""}`}
                >
                  🎙️
                </button>
              </div>
            )}
            {/* Intentionally left blank: Repeat/Loop/Ingredients used to
                live here, right at the bottom edge — too far from a
                resting thumb to reach comfortably. They've moved up to
                between the video and the steps list (see above). This
                invisible copy reserves the exact same height so the
                bottom bar doesn't resize/jump. */}
            <div className="mt-1.5 px-3" aria-hidden="true">
              <div className="invisible">{stepControlsRow}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
