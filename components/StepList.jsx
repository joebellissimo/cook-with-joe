"use client";

import { useEffect, useRef } from "react";

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StepList({ steps, activeStepId, onSelect, doneSteps, onToggleDone }) {
  const activeItemRef = useRef(null);
  // Skip the very first run (mount) — auto-centering the initial step on
  // page load would jump the scroll position before the user's done
  // anything; it should only kick in once the active step actually changes.
  const isFirstRender = useRef(true);

  // Keeps the active step centered in the scrollable list as it advances —
  // whether from natural playback progression, continuous play, looping, a
  // click, or a voice command. Only runs when activeStepId itself changes,
  // so it can't fight an in-progress manual scroll (which doesn't touch
  // this value) — it just re-centers cleanly on the next real step change.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    activeItemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeStepId]);

  if (!steps.length) {
    return (
      <p className="text-sm text-muted">
        This recipe doesn&apos;t have any steps tagged yet.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1.5 md:gap-2">
      {steps.map((step, index) => {
        const isActive = step.id === activeStepId;
        const isDone = doneSteps?.has(step.id) ?? false;
        return (
          <li key={step.id} ref={isActive ? activeItemRef : null}>
            <div
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition md:py-2 ${
                isActive
                  ? "border-brand bg-brand/5 text-ink"
                  : "border-ink/10 bg-white text-muted hover:border-brand/30 hover:bg-brand/5"
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleDone?.(step.id)}
                aria-label={isDone ? `Mark "${step.label}" not done` : `Mark "${step.label}" done`}
                aria-pressed={isDone}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs leading-none transition ${
                  isDone
                    ? "border-brand bg-brand text-white"
                    : "border-ink/25 bg-white text-transparent hover:border-brand/50"
                }`}
              >
                ✓
              </button>
              <button
                onClick={() => onSelect(step)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-medium ${isDone ? "text-muted line-through" : ""}`}>
                    {index + 1}. {step.label}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {formatTime(step.start)}–{formatTime(step.end)}
                  </span>
                </div>
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
