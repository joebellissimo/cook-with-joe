"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import StepList from "@/components/StepList";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { matchVoiceCommand } from "@/lib/voiceCommands";

export default function RecipePlayer({ recipe }) {
  const steps = recipe.steps;
  const videoRef = useRef(null);

  const [activeStepId, setActiveStepId] = useState(steps[0]?.id ?? null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [segmentEnded, setSegmentEnded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // false = "just play the whole video through" (the default on first load —
  // no stopping at step boundaries). true = "focused on one step" — entered
  // whenever you jump to a specific step by name, by list click, or via
  // Next/Previous/Repeat — at which point loop/stop-and-replay behavior
  // kicks in for that step.
  const [segmentMode, setSegmentMode] = useState(false);

  const activeIndex = useMemo(
    () => steps.findIndex((s) => s.id === activeStepId),
    [steps, activeStepId]
  );
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;

  const playStep = useCallback(
    (step) => {
      const video = videoRef.current;
      if (!video || !step) return;
      video.currentTime = step.start;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
      setActiveStepId(step.id);
      setSegmentMode(true);
      setSegmentEnded(false);
    },
    []
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
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      setSegmentEnded(false);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handlePause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    videoRef.current
      ?.play()
      .then(() => setIsPlaying(true))
      .catch(() => {});
    setSegmentEnded(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!segmentMode) {
      // Continuous playback: just keep the step list highlight following
      // the playhead — no stopping or looping at step boundaries.
      const current = steps.find(
        (s) => video.currentTime >= s.start && video.currentTime < s.end
      );
      if (current && current.id !== activeStepId) {
        setActiveStepId(current.id);
      }
      return;
    }

    if (!activeStep) return;
    if (video.currentTime >= activeStep.end - 0.12) {
      if (loopEnabled) {
        video.currentTime = activeStep.start;
      } else {
        video.pause();
        setIsPlaying(false);
        setSegmentEnded(true);
      }
    }
  }, [segmentMode, steps, activeStepId, activeStep, loopEnabled]);

  const handleVoiceCommand = useCallback(
    (transcript) => {
      const action = matchVoiceCommand(transcript, steps);

      if (action && typeof action === "object" && action.type === "goto-step") {
        playStep(action.step);
        return;
      }
      if (action && typeof action === "object" && action.type === "loop-step") {
        setLoopEnabled(true);
        playStep(action.step);
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
        case "loop-on":
          setLoopEnabled(true);
          setSegmentMode(true);
          break;
        case "loop-off":
          setLoopEnabled(false);
          break;
        case "play":
          handlePlay();
          break;
        case "pause":
          handlePause();
          break;
        default:
          break;
      }
    },
    [steps, playStep, handleNext, handlePrevious, handleRepeat, handleFirst, handlePlay, handlePause]
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
        // not silently do nothing until you also click a step.
        if (checked) setSegmentMode(true);
      }}
      className="accent-brand"
    />
  );

  return (
    // Below md: a fixed, full-viewport stack that takes over the screen
    // (video / scrollable steps / control bar) so only the steps list
    // scrolls — not the page. At md and up this reverts to the original
    // static, side-by-side grid layout.
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-cream md:static md:z-auto md:mx-auto md:block md:max-w-5xl md:overflow-visible md:px-4 md:py-6">
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
        <Link
          href={`/admin/edit/${recipe.slug}`}
          className="shrink-0 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:border-brand/40 hover:text-ink"
        >
          ✏️ Edit chapters
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:grid md:flex-none md:grid-cols-3 md:gap-6">
        <div className="shrink-0 md:col-span-2">
          <div className="relative overflow-hidden bg-black shadow md:rounded-xl">
            {/* Mobile-only title/category overlay, anchored to the top edge
                of the video instead of centered like the step-finished
                overlay below — small text, non-blocking of the frame. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 via-black/20 to-transparent px-3 pb-6 pt-2.5 md:hidden">
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/80">
                {recipe.category}
              </p>
              <h1 className="text-sm font-medium text-white">{recipe.title}</h1>
            </div>

            <video
              ref={videoRef}
              className="aspect-video w-full"
              src={recipe.video}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              playsInline
              controls
            />
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
              &ldquo;pause&rdquo;/&ldquo;stop&rdquo; — or reference a step by
              name, like &ldquo;play {steps[0]?.label?.toLowerCase()}&rdquo; or
              &ldquo;loop {steps[0]?.label?.toLowerCase()}&rdquo; (jumps there
              and keeps repeating it until you say &ldquo;stop&rdquo; or ask
              for another step).
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 md:flex-none md:overflow-visible md:px-0 md:pt-0">
          <h2 className="eyebrow heading-rule mb-4 hidden text-[11px] md:inline-block">
            Steps
          </h2>
          <StepList steps={steps} activeStepId={activeStepId} onSelect={playStep} />
        </div>
      </div>

      {/* Mobile-only control bar, fixed to the bottom of the screen — padded
          for the iOS home-indicator safe area. */}
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
        <div className="mt-1.5 flex items-center justify-center gap-4 px-3 text-xs text-muted">
          <button onClick={handleRepeat} className="flex items-center gap-1">
            ↻ Repeat
          </button>
          <label className="flex items-center gap-1.5">
            {loopCheckbox}
            Loop this step
          </label>
        </div>
      </div>
    </div>
  );
}
