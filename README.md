# Cook With Joe

A working prototype of a hands-free cooking video player: click any step to
jump to it, loop a tricky technique or let it stop-and-wait for you to
replay, and control it all by voice when your hands are full. Built with
Next.js (App Router) + Tailwind CSS — plain JavaScript, no TypeScript.

## What's here

- **Home / recipe menu** (`app/page.js`) — recipes grouped into categories
  (Meats, Appetizers, Cocktails, Desserts, Vegetarian) with a filter bar.
- **Recipe player** (`app/recipe/[slug]/page.js`, `components/RecipePlayer.jsx`)
  — the core feature. Steps are timestamp chapters over one video file:
  click a step to seek to it, toggle "Loop this step" to keep repeating a
  segment, or leave it off to have the video pause at the end of a step
  with a Replay / Next choice.
- **Voice control** (`hooks/useVoiceCommands.js`, `lib/voiceCommands.js`) —
  uses the browser's built-in SpeechRecognition API (no external service).
  Recognized phrases: "next step", "previous step", "repeat"/"replay",
  "loop on", "loop off", "first step"/"start over", "play", "pause"/"stop".
  Works best in Chrome/Edge; Safari and iOS have inconsistent support for
  this browser API as of this build.
- **Auto-chapter script** (`scripts/auto_chapters.py`) — a CLI tool that
  transcribes a full-length video locally with faster-whisper (no API key,
  no cloud upload) and proposes step boundaries using pause detection plus
  cooking-instruction keywords ("add", "chop", "simmer", ...). Output is a
  JSON file shaped like a recipe entry — a starting point to refine, not a
  finished result.
- **Chapter editor** (`app/admin/upload`, `app/admin/edit/[slug]`,
  `components/ChapterEditor.jsx`) — load a video locally, scrub to a
  moment and tag a step, or import the auto-chapter script's JSON output
  and adjust anything it got wrong. Exports JSON to merge into
  `data/recipes.json`.
- **Pricing page** (`app/pricing/page.js`) — placeholder for the
  subscription tier. Recipes already carry a `premium: true/false` flag in
  the data model, so gating access later is a small change, not a rebuild.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The "Quick Onion Pasta Sauce (Demo)"
recipe has a real (synthetic) video with narration and five tagged steps so
you can try clicking steps, toggling loop, and using voice control
end-to-end. The other recipe cards are placeholders — they show how
categories and the "not activated yet" state look before a video is
attached.

## Adding your own recipes

Right now content lives in `data/recipes.json` and video files live in
`public/videos/` — there's no database or file upload server yet (see
"What's not built yet" below). To add a recipe today:

1. Put the video file in `public/videos/your-video.mp4`.
2. Get step timestamps either by hand (open `/admin/upload`, load the
   video, scrub and tag steps, export JSON) or with a first AI pass:
   ```bash
   pip install faster-whisper
   python3 scripts/auto_chapters.py public/videos/your-video.mp4 \
     --slug your-recipe --title "Your Recipe" --category Meats
   ```
   Note: the first run downloads a Whisper model from Hugging Face, so it
   needs an internet connection on whatever machine you run it from (this
   sandboxed session couldn't reach huggingface.co to test the download
   itself, but the transcription-to-steps logic is included and was
   verified separately with simulated transcript data — see the build
   history below).
3. Paste that JSON into `/admin/edit`'s import box (or `/admin/upload` for
   a brand-new recipe) to fine-tune the timestamps/labels against the
   actual video, then copy or download the final JSON.
4. Add that JSON object into the `recipes` array in `data/recipes.json`.

## What's not built yet (the honest next-steps list)

This is a prototype meant to prove out the interaction model, not a
production app. Before real users and real subscriptions:

- **Video hosting** — files currently sit in `public/videos/` and ship
  with the app itself. For real use, move to a video-specific host
  (Cloudflare Stream or Mux are good fits — both handle adaptive
  streaming across phone/tablet/laptop and can auto-caption, which
  overlaps with the auto-chapter feature).
- **A real upload flow** — today, adding a recipe means manually copying
  files and editing JSON. A production version needs a server-side upload
  endpoint and a database (e.g. Postgres via Supabase) instead of a static
  JSON file.
- **Accounts + Stripe** — the pricing page is a placeholder; wiring up
  real subscriptions means adding auth and Stripe Checkout/Billing, then
  checking the existing `premium` flag before serving a recipe's video.
- **Deployment** — this runs locally via `npm run dev`/`npm run build`.
  Vercel is the most direct path to putting it on the internet, given it's
  a Next.js app.

## Project structure

```
app/                    routes (Next.js App Router)
  page.js               home / recipe menu
  recipe/[slug]/         recipe player page
  admin/upload/          add-a-recipe workflow
  admin/edit/[slug]/     edit an existing recipe's chapters
  pricing/               subscription placeholder
components/             RecipePlayer, StepList, ChapterEditor, RecipeCard
hooks/useVoiceCommands.js   SpeechRecognition wrapper
lib/                    recipes.js (data access), voiceCommands.js (phrase matching)
data/recipes.json       all recipe + step data
public/videos/          video files (currently the one demo video)
scripts/auto_chapters.py   local Whisper-based chapter suggestion CLI
```
