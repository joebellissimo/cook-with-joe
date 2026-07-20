export default function WatchReadToggle({ mode, onWatch, onRead, className = "" }) {
  return (
    <div
      className={`inline-flex shrink-0 rounded-full border border-ink/15 bg-white p-0.5 text-xs font-medium ${className}`}
    >
      <button
        onClick={onWatch}
        aria-pressed={mode === "watch"}
        className={`rounded-full px-3 py-1 transition ${
          mode === "watch" ? "bg-brand text-white" : "text-muted hover:text-ink"
        }`}
      >
        Watch
      </button>
      <button
        onClick={onRead}
        aria-pressed={mode === "read"}
        className={`rounded-full px-3 py-1 transition ${
          mode === "read" ? "bg-brand text-white" : "text-muted hover:text-ink"
        }`}
      >
        Read
      </button>
    </div>
  );
}
