"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import StepList from "@/components/StepList";
import WatchReadToggle from "@/components/WatchReadToggle";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { matchVoiceCommand } from "@/lib/voiceCommands";
import { playIngredientCheckedSound, playIngredientUncheckedSound } from "@/lib/sound";

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
  const [checkedIngredients, setCheckedIngredients] = useState(() => new Set());
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

  const toggleIngredientChecked = useCallback(
    (index) => {
      // Decided from current state rather than inside the setState updater,
      // so the sound (a side effect) can't fire twice under React Strict
      // Mode's dev-only double-invocation of updater functions.
      const willBeChecked = !checkedIngredients.has(index);
      setCheckedIngredients((prev) => {
        const next = new Set(prev);
        if (willBeChecked) next.add(index);
        else next.delete(index);
        return next;
      });
      if (willBeChecked) playIngredientCheckedSound();
      else playIngredientUncheckedSound();
    },
    [checkedIngredients]
  );

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
        // Explicitly set checked (not a toggle) — saying "check off eggs"
        // when eggs is already checked shouldn't accidentally uncheck it.
        setCheckedIngredients((prev) => new Set(prev).add(action.index));
        playIngredientCheckedSound();
        setShowIngredients(true);
        return;
      }
      if (action && typeof action === "object" && action.type === "uncheck-ingredient") {
        setCheckedIngredients((prev) => {
          const next = new Set(prev);
          next.delete(action.index);
          return next;
        });
        playIngredientUncheckedSound();
        setShowIngredients(true);
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
        case "scroll-down": {
          const el = showIngredients ? ingredientsListRef.current : stepsListRef.current;
          el?.scrollBy({ top: el.clientHeight, behavior: "smooth" });
          break;
        }
        case "scroll-up": {
          const el = showIngredients ? ingredientsListRef.current : stepsListRef.current;
          el?.scrollBy({ top: -el.clientHeight, behavior: "smooth" });
          break;
        }
        case "scroll-top": {
          const el = showIngredients ? ingredientsListRef.current : stepsListRef.current;
          el?.scrollTo({ top: 0, behavior: "smooth" });
          break;
        }
        case "scroll-bottom": {
          const el = showIngredients ? ingredientsListRef.current : stepsListRef.current;
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
                <ul className="space-y-2 text-sm">
                  {recipe.ingredients.map((ingredient, i) => (
                    <li key={i}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checkedIngredients.has(i)}
                          onChange={() => toggleIngredientChecked(i)}
                          className="accent-brand"
                        />
                        <span className={checkedIngredients.has(i) ? "text-muted line-through" : "text-ink"}>
                          {ingredient}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Inline controls row + voice hints — md and up only; mobile has
              its own fixed bottom control bar instead. */}
          <div className="hidden md:block">
            <div className="mt-3 flex flex-wrap items-center gap-2">
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

              <button
                onClick={voice.toggle}
                disabled={!voice.supported}
                className={`ml-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-40 ${
                  voice.listening ? "bg-red-600" : "bg-brand hover:bg-brand-dark"
                }`}
                title={voice.supported ? "Toggle voice control" : "Voice control isn't supported in this browser"}
              >
                🎙️ {voice.listening ? "Listening…" : "Voice control"}
              </button>
            </div>

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
              &ldquo;normal speed&rdquo; — or reference a step by name, like
              &ldquo;play {steps[0]?.label?.toLowerCase()}&rdquo; or
              &ldquo;loop {steps[0]?.label?.toLowerCase()}&rdquo; (jumps
              there and keeps repeating it until you say &ldquo;stop&rdquo;
              or ask for another step), or add &ldquo;at half speed&rdquo;
              to either.
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
          {stepControlsRow}
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
            <h2 className="eyebrow heading-rule mb-4 hidden text-[11px] md:inline-block">
              Steps
            </h2>
            {/* currentStep (not activeStepId) drives the highlight/auto-
                scroll — null in a gap, which StepList already handles by
                just not matching any item, no highlight, no scroll. */}
            <StepList steps={steps} activeStepId={currentStep?.id ?? null} onSelect={playStep} />
          </div>

          {/* Mobile-only control bar, sitting right below the steps list —
              padded for the iOS home-indicator safe area. */}
          <div className="shrink-0 border-t border-ink/10 bg-white pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:hidden">
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
                }`}
              >
                🎙️
              </button>
            </div>
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
