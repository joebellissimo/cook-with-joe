import UploadWithImport from "@/components/UploadWithImport";

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
          Optionally use <strong>Import from URL</strong> below to pull the
          title, category, intro, ingredients, tips, and steps from an
          existing recipe page — everything prefills so you can review it,
          not publish it outright.
        </li>
        <li>
          Or run{" "}
          <code className="rounded bg-neutral-100 px-1">
            python3 scripts/auto_chapters.py your-video.mp4 --slug ... --title
            ... --category ...
          </code>{" "}
          on your own machine to get an AI first pass at the step timestamps
          (uses local speech-to-text — no cloud API key needed).
        </li>
        <li>Load the same video below and paste that script&apos;s JSON output into &ldquo;Import AI-suggested chapters&rdquo; to prefill the editor.</li>
        <li>Scrub through, fix any timestamps or labels that are off, and add/remove steps as needed.</li>
        <li>Click <strong>Publish to site</strong> — the video uploads directly to storage and the recipe goes live immediately.</li>
      </ol>

      <div className="mt-6">
        <UploadWithImport />
      </div>
    </div>
  );
}
