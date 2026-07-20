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
  return { id: nextLocalId, label: "New step", start, end };
}

function fmt(n) {
  return Math.round(n * 100) / 100;
}

export default function ChapterEditor({ initialRecipe }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPath, setVideoPath] = useState(initialRecipe?.video || "");
  const [title, setTitle] = useState(initialRecipe?.title || "");
  const [slug, setSlug] = useState(initialRecipe?.slug || "");
  const [category, setCategory] = useState(initialRecipe?.category || "Meats");
  const [premium, setPremium] = useState(Boolean(initialRecipe?.premium));
  const [steps, setSteps] = useState(initialRecipe?.steps || []);
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
      category,
      premium,
      description: "",
      video: videoPath,
      thumbnail: "",
      steps: chronological.map((s, i) => ({
        id: i + 1,
        label: s.label,
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
      if (parsed.video) setVideoPath(parsed.video);
      if (Array.isArray(parsed.steps)) {
        setSteps(
          parsed.steps.map((s) => {
            nextLocalId += 1;
            return {
              id: nextLocalId,
              label: s.label || "Step",
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

      const res = await fetch("/api/admin/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalRecipe),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Publish failed (${res.status})`);
      }

      setVideoPath(videoUrl);
      setVideoFile(null);
      setPublishState("success");
    } catch (err) {
      setPublishState("error");
      setPublishMessage(err.message || "Something went wrong while publishing.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            1. Load a video to scrub through — it only uploads to storage
            once you click &ldquo;Publish to site&rdquo; below.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handlePickVideo}
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-orange-600 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-orange-700"
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
            <div className="flex aspect-video items-center justify-center text-sm text-neutral-400">
              No video loaded yet
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm text-neutral-600 shadow-sm">
          <span>
            Current time: <strong>{fmt(currentTime)}s</strong>
          </span>
          <button
            onClick={addStepAtCurrentTime}
            disabled={!videoSrc}
            className="rounded-full bg-orange-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            + Add step here
          </button>
        </div>
        {videoSrc && (
          <p className="mt-1 text-xs text-neutral-400">
            Tip: with the video loaded (and not typing in a field), the{" "}
            <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1">Left</kbd>{" "}
            /{" "}
            <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1">Right</kbd>{" "}
            arrow keys step one frame at a time — handy for lining up
            back-to-back segments precisely.
          </p>
        )}

        <div className="mt-4">
          {displaySteps.length === 0 && (
            <p className="text-sm text-neutral-500">
              No steps yet — load a video, scrub to a moment, and click
              &ldquo;Add step here&rdquo;, or import AI-suggested chapters
              below.
            </p>
          )}
          {displaySteps.length > 0 && (
            <p className="mb-2 text-xs text-neutral-400">
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
                className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
              >
                <input
                  value={step.label}
                  onChange={(e) => updateStep(step.id, { label: e.target.value })}
                  className="mb-2 w-full rounded border border-neutral-200 px-2 py-1 text-sm font-medium"
                  placeholder="e.g. Mince the onions"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <label className="flex items-center gap-1">
                    Start
                    <input
                      type="number"
                      step="0.1"
                      value={step.start}
                      onChange={(e) =>
                        updateStep(step.id, { start: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 rounded border border-neutral-200 px-1 py-0.5"
                    />
                  </label>
                  <button
                    onClick={() => setFieldToCurrentTime(step.id, "start")}
                    className="rounded border border-neutral-200 px-2 py-0.5 hover:border-orange-300"
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
                      className="w-20 rounded border border-neutral-200 px-1 py-0.5"
                    />
                  </label>
                  <button
                    onClick={() => setFieldToCurrentTime(step.id, "end")}
                    className="rounded border border-neutral-200 px-2 py-0.5 hover:border-orange-300"
                  >
                    set to current
                  </button>
                  <button
                    onClick={() => previewStep(step)}
                    disabled={!videoSrc}
                    className="rounded border border-neutral-200 px-2 py-0.5 hover:border-orange-300 disabled:opacity-40"
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
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">
            Recipe details
          </h3>
          <div className="space-y-2 text-sm">
            <label className="block">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-200 px-2 py-1"
              />
            </label>
            <label className="block">
              Slug
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-200 px-2 py-1"
                placeholder="e.g. garlic-butter-steak"
              />
            </label>
            <label className="block">
              Category
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-200 px-2 py-1"
              />
            </label>
            <label className="block">
              Video URL
              <input
                value={videoPath}
                onChange={(e) => setVideoPath(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-200 px-2 py-1"
                placeholder="filled in automatically after publishing"
              />
            </label>
            <label className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={premium}
                onChange={(e) => setPremium(e.target.checked)}
                className="accent-orange-600"
              />
              Premium / subscriber-only
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            Import AI-suggested chapters
          </h3>
          <p className="mb-2 text-xs text-neutral-500">
            Paste the JSON produced by{" "}
            <code className="rounded bg-neutral-100 px-1">
              scripts/auto_chapters.py
            </code>{" "}
            to prefill the fields and steps above, then adjust anything that
            looks off.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            className="w-full rounded border border-neutral-200 px-2 py-1 font-mono text-xs"
            placeholder='{ "title": "...", "steps": [...] }'
          />
          <button
            onClick={handleImport}
            className="mt-2 w-full rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Load into editor
          </button>
          {importStatus && (
            <p className="mt-2 text-xs text-neutral-500">{importStatus}</p>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            Publish
          </h3>
          <p className="mb-3 text-xs text-neutral-500">
            {videoFile
              ? "Uploads the new video and saves this recipe live."
              : "Saves this recipe live, keeping its current video."}
          </p>
          <button
            onClick={handlePublish}
            disabled={publishState === "uploading" || publishState === "saving"}
            className="w-full rounded-full bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
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
