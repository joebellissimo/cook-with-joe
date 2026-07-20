function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StepList({ steps, activeStepId, onSelect }) {
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
        return (
          <li key={step.id}>
            <button
              onClick={() => onSelect(step)}
              className={`w-full rounded-lg border px-3 py-1.5 text-left text-sm transition md:py-2 ${
                isActive
                  ? "border-brand bg-brand/5 text-ink"
                  : "border-ink/10 bg-white text-muted hover:border-brand/30 hover:bg-brand/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {index + 1}. {step.label}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {formatTime(step.start)}–{formatTime(step.end)}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
