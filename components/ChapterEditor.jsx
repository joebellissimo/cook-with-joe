"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";

// Assumes ~30fps — there's no reliable way to read a plain <video> element's
// actual frame rate in the browser, so this is a close-enough nudge amount
// for lining up back-to-back segments rather than an exact single frame.
const FRAME_STEP_SECONDS = 1 / 30;

let nextLocalId = 1000;

function blankStep(start = 0, end = 5) {
  nextLocalId += 1;
  return { id: nextLocalId, label: "New step", direction: "", start, end };
}

// Textarea -> array of non-empty lines, for Ingredients/Tips.
function linesToList(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function fmt(n) {
  return Math.round(n * 100) / 100;
}

export default function ChapterEditor({ initialRecipe }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  // The slug this recipe was originally loaded with — fixed at mount, not
  // the (editable) slug field's current value. Lets publish detect a rename
  // and tell the server to remove the old entry instead of leaving it
  // behind as an orphaned duplicate.
  const originalSlugRef = useRef(initialRecipe?.slug || null);
  // Not user-editable (no UI for it yet — single-chef app for now), just
  // carried through so republishing an existing recipe doesn't silently
  // drop it. Defaults to "joe" for brand-new recipes.
  const ownerIdRef = useRef(initialRecipe?.ownerId || "joe");

  // A recipe's video is a real, browser-playable Blob URL once published (or
  // imported), so it can load straight into the scrubber — no need to
  // re-pick the local file just to preview it.
  const [videoSrc, setVideoSrc] = useState(initialRecipe?.video || null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPath, setVideoPath] = useState(initialRecipe?.video || "");
  const [thumbnail, setThumbnail] = useState(initialRecipe?.thumbnail || "");
  const [title, setTitle] = useState(initialRecipe?.title || "");
  const [slug, setSlug] = useState(initialRecipe?.slug || "");
  const [category, setCategory] = useState(initialRecipe?.category || "Meats");
  const [premium, setPremium] = useState(Boolean(initialRecipe?.premium));
  const [intro, setIntro] = useState(initialRecipe?.intro || "");
  const [ingredientsText, setIngredientsText] = useState(
    (initialRecipe?.ingredients || []).join("\n")
  );
  const [tipsText, setTipsText] = useState((initialRecipe?.tips || []).join("\n"));
  const [steps, setSteps] = useState(
    (initialRecipe?.steps || []).map((s) => ({ direction: "", ...s }))
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [publishState, setPublishState] = useState("idle"); // idle | uploading | saving | success | error
  const [publishMessage, setPublishMessage] = useState("");

  const handlePickVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoFile(file);
  };

  const addStepAtCurrentTime = () => {
    const start = fmt(currentTime);
    setSteps((s) => [...s, blankStep(start, fmt(start + 5))]);
  };

  const updateStep = (id, patch) => {
    setSteps((s) => s.map((st) => (st.id === id ? { ...st, ...patch } : st)));
  };

  const removeStep = (id) => {
    setSteps((s) => s.filter((st) => st.id !== id));
  };

  const setFieldToCurrentTime = (id, field) => {
    updateStep(id, { [field]: fmt(currentTime) });
  };

  const previewStep = (step) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = step.start;
    v.play().catch(() => {});
  };

  // Editing list: most-recently-added step first, so you never have to
  // scroll down to reach the one you just tagged. The exported recipe
  // (below) is sorted by start time instead, since playback order should
  // always follow the video regardless of the order steps were tagged in.
  const displaySteps = [...steps].reverse();

  const buildRecipeObject = () => {
    const chronological = [...steps].sort((a, b) => a.start - b.start);
    return {
      slug: slug || "untitled-recipe",
      title: title || "Untitled recipe",
      ownerId: ownerIdRef.current,
      category,
      premium,
      description: "",
      intro,
      ingredients: linesToList(ingredientsText),
      tips: linesToList(tipsText),
      video: videoPath,
      thumbnail,
      steps: chronological.map((s, i) => ({
        id: i + 1,
        label: s.label,
        direction: s.direction || "",
        start: fmt(s.start),
        end: fmt(s.end),
      })),
    };
  };

  // Left/right arrow keys step one frame at a time instead of the browser's
  // default several-second seek — much faster for lining up back-to-back
  // segments. Disabled while typing in a text field so normal cursor
  // movement (e.g. editing a label or a start/end number) still works.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const active = document.activeElement;
      const tag = active?.tagName;
      const isEditableField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active?.isContentEditable;
      if (isEditableField) return;

      const video = videoRef.current;
      if (!video) return;

      e.preventDefault();
      const delta = e.key === "ArrowRight" ? FRAME_STEP_SECONDS : -FRAME_STEP_SECONDS;
      video.currentTime = Math.min(
        video.duration || Infinity,
        Math.max(0, video.currentTime + delta)
      );
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.slug) setSlug(parsed.slug);
      if (parsed.category) setCategory(parsed.category);
      if (typeof parsed.premium === "boolean") setPremium(parsed.premium);
      if (parsed.intro) setIntro(parsed.intro);
      if (Array.isArray(parsed.ingredients)) setIngredientsText(parsed.ingredients.join("\n"));
      if (Array.isArray(parsed.tips)) setTipsText(parsed.tips.join("\n"));
      if (parsed.video) setVideoPath(parsed.video);
      if (parsed.thumbnail) setThumbnail(parsed.thumbnail);
      if (Array.isArray(parsed.steps)) {
        setSteps(
          parsed.steps.map((s) => {
            nextLocalId += 1;
            return {
              id: nextLocalId,
              label: s.label || "Step",
              direction: s.direction || "",
              start: Number(s.start) || 0,
              end: Number(s.end) || Number(s.start) + 5 || 5,
            };
          })
        );
      }
      setImportStatus("Imported.");
    } catch (e) {
      setImportStatus("That doesn't look like valid JSON.");
    }
    setTimeout(() => setImportStatus(""), 2500);
  };

  const handlePublish = async () => {
    setPublishState("uploading");
    setPublishMessage("");

    try {
      const recipe = buildRecipeObject();
      let videoUrl = recipe.video;

      if (videoFile) {
        const pathname = `videos/${recipe.slug}-${Date.now()}.mp4`;
        const blob = await upload(pathname, videoFile, {
          access: "public",
          handleUploadUrl: "/api/admin/upload-video",
        });
        videoUrl = blob.url;
      }

      if (!videoUrl) {
        throw new Error("Load a video or set a video URL before publishing.");
      }

      setPublishState("saving");
      const finalRecipe = { ...recipe, video: videoUrl };

      const originalSlug = originalSlugRef.current;
      const slugChanged = Boolean(originalSlug && originalSlug !== finalRecipe.slug);

      const res = await fetch("/api/admin/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe: finalRecipe,
          ...(slugChanged ? { originalSlug } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Publish failed (${res.status})`);
      }

      setVideoPath(videoUrl);
      setVideoFile(null);
      setPublishState("success");
      // The new slug is now this recipe's slug of record — a second publish
      // in the same session shouldn't try to delete an already-gone entry.
      originalSlugRef.current = finalRecipe.slug;
    } catch (err) {
      setPublishState("error");
      setPublishMessage(err.message || "Something went wrong while publishing.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-dashed border-ink/15 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-ink">
            1. Load a video to scrub through — it only uploads to storage
            once you click &ldquo;Publish to site&rdquo; below.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handlePickVideo}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark"
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl bg-black shadow">
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              className="aspect-video w-full"
              controls
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-muted">
              No video loaded yet
            </div>
          )}
          {/* Controls for the step currently being tagged — kept inside the
              same rounded/clipped container as the video, directly below
              the native scrubber with no gap, so marking a step is the
              very next action after scrubbing to it. */}
          <div className="flex items-center justify-between border-t border-ink/10 bg-white px-4 py-2 text-sm text-muted">
            <span>
              Current time: <strong>{fmt(currentTime)}s</strong>
            </span>
            <button
              onClick={addStepAtCurrentTime}
              disabled={!videoSrc}
              className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              + Add step here
            </button>
          </div>
        </div>

        {videoSrc && (
          <p className="mt-3 text-xs text-muted">
            Tip: with the video loaded (and not typing in a field), the{" "}
            <kbd className="rounded border border-ink/15 bg-cream px-1">Left</kbd>{" "}
            /{" "}
            <kbd className="rounded border border-ink/15 bg-cream px-1">Right</kbd>{" "}
            arrow keys step one frame at a time — handy for lining up
            back-to-back segments precisely.
          </p>
        )}

        <div className="mt-4">
          {displaySteps.length === 0 && (
            <p className="text-sm text-muted">
              No steps yet — load a video, scrub to a moment, and click
              &ldquo;Add step here&rdquo;, or import AI-suggested chapters
              below.
            </p>
          )}
          {displaySteps.length > 0 && (
            <p className="mb-2 text-xs text-muted">
              Everything below saves automatically as you type or click
              &ldquo;set to current&rdquo; — there&apos;s no separate save
              button per step. Newest step is at the top. When all your steps
              look right, scroll down to <strong>Publish</strong> to add this
              recipe to the library.
            </p>
          )}
          <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-lg pr-1">
            {displaySteps.map((step) => (
              <div
                key={step.id}
                className="rounded-lg border border-ink/10 bg-white p-3 shadow-sm"
              >
                <input
                  value={step.label}
                  onChange={(e) => updateStep(step.id, { label: e.target.value })}
                  className="mb-1 w-full rounded border border-ink/10 px-2 py-1 text-sm font-medium"
                  placeholder="e.g. Mince the onions"
                />
                <input
                  value={step.direction || ""}
                  onChange={(e) => updateStep(step.id, { direction: e.target.value })}
                  className="mb-2 w-full rounded border border-ink/10 px-2 py-1 text-xs text-muted"
                  placeholder="Full instruction sentence for the Read view (optional)"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <label className="flex items-center gap-1">
                    Start
                    <input
                      type="number"
                      step="0.1"
                      value={step.start}
                      onChange={(e) =>
                        updateStep(step.id, { start: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 rounded border border-ink/10 px-1 py-0.5"
                    />
                  </label>
                  <button
                    onClick={() => setFieldToCurrentTime(step.id, "start")}
                    className="rounded border border-ink/10 px-2 py-0.5 hover:border-brand/40"
                  >
                    set to current
                  </button>
                  <label className="flex items-center gap-1">
                    End
                    <input
                      type="number"
                      step="0.1"
                      value={step.end}
                      onChange={(e) =>
                        updateStep(step.id, { end: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 rounded border border-ink/10 px-1 py-0.5"
                    />
                  </label>
                  <button
                    onClick={() => setFieldToCurrentTime(step.id, "end")}
                    className="rounded border border-ink/10 px-2 py-0.5 hover:border-brand/40"
                  >
                    set to current
                  </button>
                  <button
                    onClick={() => previewStep(step)}
                    disabled={!videoSrc}
                    className="rounded border border-ink/10 px-2 py-0.5 hover:border-brand/40 disabled:opacity-40"
                  >
                    ▶ preview
                  </button>
                  <button
                    onClick={() => removeStep(step.id)}
                    className="ml-auto rounded border border-red-200 px-2 py-0.5 text-red-600 hover:bg-red-50"
                  >
                    delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <h3 className="eyebrow heading-rule mb-4 inline-block text-[11px]">
            Recipe details
          </h3>
          <div className="space-y-2 text-sm">
            <label className="block">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded border border-ink/10 px-2 py-1"
              />
            </label>
            <label className="block">
              Slug
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1 w-full rounded border border-ink/10 px-2 py-1"
                placeholder="e.g. garlic-butter-steak"
              />
            </label>
            <label className="block">
              Category
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded border border-ink/10 px-2 py-1"
              />
            </label>
            <label className="block">
              Video URL
              <input
                value={videoPath}
                onChange={(e) => setVideoPath(e.target.value)}
                className="mt-1 w-full rounded border border-ink/10 px-2 py-1"
                placeholder="filled in automatically after publishing"
              />
            </label>
            <label className="block">
              Thumbnail URL
              <input
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                className="mt-1 w-full rounded border border-ink/10 px-2 py-1"
                placeholder="filled in automatically when imported"
              />
            </label>
            <label className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={premium}
                onChange={(e) => setPremium(e.target.checked)}
                className="accent-brand"
              />
              Premium / subscriber-only
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <h3 className="eyebrow heading-rule mb-4 inline-block text-[11px]">
            Story &amp; ingredients
          </h3>
          <p className="mb-2 text-xs text-muted">
            Shown in the recipe&apos;s <strong>Read</strong> view, alongside
            the full instruction sentences from each step&apos;s
            &ldquo;direction&rdquo; field above.
          </p>
          <div className="space-y-3 text-sm">
            <label className="block">
              Intro
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-ink/10 px-2 py-1"
                placeholder="A short story or context paragraph for this recipe."
              />
            </label>
            <label className="block">
              Ingredients
              <textarea
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded border border-ink/10 px-2 py-1 font-mono text-xs"
                placeholder={"One ingredient per line, e.g.\n2 cloves garlic, minced"}
              />
            </label>
            <label className="block">
              Tips
              <textarea
                value={tipsText}
                onChange={(e) => setTipsText(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded border border-ink/10 px-2 py-1 font-mono text-xs"
                placeholder={"One tip per line, e.g.\nLet the meat rest 5 minutes before slicing."}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <h3 className="eyebrow heading-rule mb-4 inline-block text-[11px]">
            Import AI-suggested chapters
          </h3>
          <p className="mb-2 text-xs text-muted">
            Paste the JSON produced by{" "}
            <code className="rounded bg-cream px-1">
              scripts/auto_chapters.py
            </code>{" "}
            to prefill the fields and steps above, then adjust anything that
            looks off.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            className="w-full rounded border border-ink/10 px-2 py-1 font-mono text-xs"
            placeholder='{ "title": "...", "steps": [...] }'
          />
          <button
            onClick={handleImport}
            className="mt-2 w-full rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Load into editor
          </button>
          {importStatus && (
            <p className="mt-2 text-xs text-muted">{importStatus}</p>
          )}
        </div>

        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <h3 className="eyebrow heading-rule mb-4 inline-block text-[11px]">
            Publish
          </h3>
          <p className="mb-3 text-xs text-muted">
            {videoFile
              ? "Uploads the new video and saves this recipe live."
              : "Saves this recipe live, keeping its current video."}
          </p>
          <button
            onClick={handlePublish}
            disabled={publishState === "uploading" || publishState === "saving"}
            className="w-full rounded-full bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {publishState === "uploading"
              ? "Uploading video…"
              : publishState === "saving"
                ? "Publishing…"
                : "Publish to site"}
          </button>

          {publishState === "success" && (
            <p className="mt-2 text-sm text-green-700">
              Published!{" "}
              <Link href={`/recipe/${slug}`} className="underline">
                View the live recipe
              </Link>
              .
            </p>
          )}
          {publishState === "error" && (
            <p className="mt-2 text-sm text-red-600">{publishMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
