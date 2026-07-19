import ChapterEditor from "@/components/ChapterEditor";

export const metadata = {
  title: "Upload & auto-chapter — Cook With Joe",
};

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900">
        Add a new recipe
      </h1>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-600">
        <li>
          Run{" "}
          <code className="rounded bg-neutral-100 px-1">
            python3 scripts/auto_chapters.py your-video.mp4 --slug ... --title
            ... --category ...
          </code>{" "}
          on your own machine to get an AI first pass at the step timestamps
          (uses local speech-to-text — no cloud API key needed).
        </li>
        <li>Load the same video below and paste that script&apos;s JSON output into &ldquo;Import AI-suggested chapters&rdquo; to prefill the editor.</li>
        <li>Scrub through, fix any timestamps or labels that are off, and add/remove steps as needed.</li>
        <li>Copy or download the final JSON, drop the video file into <code className="rounded bg-neutral-100 px-1">public/videos/</code>, and merge the JSON into <code className="rounded bg-neutral-100 px-1">data/recipes.json</code>.</li>
      </ol>
      <p className="mt-2 text-xs text-neutral-400">
        This prototype doesn&apos;t have a server-side upload yet — everything
        below runs locally in your browser tab. That&apos;s the next thing to
        wire up before this goes to real users.
      </p>

      <div className="mt-6">
        <ChapterEditor />
      </div>
    </div>
  );
}
