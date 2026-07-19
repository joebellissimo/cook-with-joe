function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StepList({ steps, activeStepId, onSelect }) {
  if (!steps.length) {
    return (
      <p className="text-sm text-neutral-500">
        This recipe doesn&apos;t have any steps tagged yet.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, index) => {
        const isActive = step.id === activeStepId;
        return (
          <li key={step.id}>
            <button
              onClick={() => onSelect(step)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                isActive
                  ? "border-orange-500 bg-orange-50 text-orange-900"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-orange-200 hover:bg-orange-50/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {index + 1}. {step.label}
                </span>
                <span className="shrink-0 text-xs text-neutral-400">
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
