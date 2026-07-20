"use client";

import { useState } from "react";
import ChapterEditor from "@/components/ChapterEditor";

export default function UploadWithImport() {
  const [url, setUrl] = useState("");
  const [importState, setImportState] = useState("idle"); // idle | loading | error
  const [importError, setImportError] = useState("");
  const [importedRecipe, setImportedRecipe] = useState(null);
  const [editorKey, setEditorKey] = useState(0);

  const handleFetchRecipe = async () => {
    if (!url.trim()) return;
    setImportState("loading");
    setImportError("");

    try {
      const res = await fetch("/api/admin/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || `Import failed (${res.status})`);
      }

      setImportedRecipe({
        title: body.title || "",
        category: body.category || "Meats",
        intro: body.intro || "",
        ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
        tips: Array.isArray(body.tips) ? body.tips : [],
        // Populated only when the source page had a detectable video/image —
        // already uploaded to Blob server-side, so the video loads straight
        // into the scrubber below with nothing left to re-upload.
        video: body.video || "",
        thumbnail: body.thumbnail || "",
        // Timestamps are still left blank for manual in/out tagging — the
        // import brings the video in, but chapter-tagging is unchanged.
        steps: Array.isArray(body.steps)
          ? body.steps.map((s) => ({
              label: s.label || "",
              direction: s.direction || "",
              start: "",
              end: "",
            }))
          : [],
      });
      // Remounts ChapterEditor with the new initialRecipe so its internal
      // state (seeded once, at mount, from that prop) picks up the import.
      setEditorKey((k) => k + 1);
      setImportState("idle");
    } catch (err) {
      setImportState("error");
      setImportError(err.message || "Something went wrong importing that page.");
    }
  };

  return (
    <>
      <div className="mb-6 rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="eyebrow heading-rule mb-3 inline-block text-[11px]">
          Import from URL
        </h2>
        <p className="mb-2 text-xs text-muted">
          Paste a link to a recipe elsewhere on the web — title, category,
          intro, ingredients, tips, and steps prefill the editor below so you
          can review, attach a video, and tag timestamps before publishing.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/some-recipe"
            className="flex-1 rounded border border-ink/10 px-2 py-1.5 text-sm"
          />
          <button
            onClick={handleFetchRecipe}
            disabled={importState === "loading" || !url.trim()}
            className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {importState === "loading" ? "Fetching…" : "Fetch recipe"}
          </button>
        </div>
        {importState === "error" && (
          <p className="mt-2 text-sm text-red-600">{importError}</p>
        )}
      </div>

      <ChapterEditor key={editorKey} initialRecipe={importedRecipe} />
    </>
  );
}
