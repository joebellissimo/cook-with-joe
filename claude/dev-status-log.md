# Cook With Joe — Development Status Log

Last updated: 2026-07-23 (session 7)

## Architecture (confirmed working)

- **Repo:** `github.com/joebellissimo/cook-with-joe` (local at
  `/Users/joebellissimo/Downloads/cook-with-joe` on Joe's Mac)
- **Deployment:** Vercel project `cook-with-joe`, project ID
  `prj_wgpRr4ZKe6uiM5Rk5uEbfAMP3jCW`, live at https://cook-with-joe.vercel.app
- **Stack:** Next.js (App Router), Tailwind CSS, plain JavaScript (no TypeScript)
- **Data today:** recipe data lives in Vercel Blob (`lib/recipesStore.js`),
  seeded from `data/recipes.json`. The local JSON file can drift from what's
  actually live in Blob — Blob is the source of truth for production content.
- Voice control logic lives in `hooks/useVoiceCommands.js` (SpeechRecognition
  wrapper) and `lib/voiceCommands.js` (phrase matching).
- Recipe player UI lives in `components/RecipePlayer.jsx`.
- **Vercel preview deployments (`*.vercel.app` branch URLs) have Deployment
  Protection (an SSO wall) enabled** — any unauthenticated automated request
  (curl, a bare fetch, etc.) gets redirected to a Vercel login, no exceptions.
  Discovered 2026-07-22 while debugging the Start Cooking scroll bug (see
  below). **Production** (`cook-with-joe.vercel.app`) is NOT behind this
  wall — confirmed via plain curl. Matters for any future automated testing
  against preview URLs: a real authenticated browser session (or a Protection
  Bypass for Automation secret, under Project Settings → Deployment
  Protection, not yet set up) is required to reach them programmatically.

## ✅ Git divergence resolved (2026-07-22)

The earlier local/origin `main` divergence (local had an uncherry-picked
overlay-fix commit plus a landing-test commit that origin didn't have) was
resolved while shipping the voice-lock-on-phone-lock feature: the mic-lock
commit was cherry-picked cleanly onto a branch off `origin/main`, verified,
merged to `main`, and pushed. Local `main` now tracks `origin/main` cleanly
with no divergence.

## Features shipped and confirmed working in production

1. **Delete recipe/video** — admin edit page has a delete button with a
   confirmation modal, removes the recipe and its video from Blob.
2. **Half-speed (0.5x) playback control**, voice-driven — `"play [step] at
   half speed"` (resets after), `"loop [step] at half speed"` (persists until
   loop off or step change), standalone `"half speed"`/`"normal speed"`
   toggle, visual badge when active.
3. **`ownerId` field** on every recipe (hardcoded `"joe"` today) — prep for
   Phase 1's real `owner_id` FK.
4. **Continuous-play fix** — "play" after a step's natural pause now means
   continuous play from that point forward, not a broken re-pause loop.
   Resets only on manual step navigation.
5. **Current-step title overlay** on the video player, restyled to white
   background/75% opacity/bold/left-justified/larger text, plus
   **auto-centering** of the active step in the scrollable steps list.
6. **Overlay-during-gaps fix** — the title overlay and step auto-centering
   previously kept showing/highlighting the nearest step even during
   undefined gaps (before step 1, after the last step, between steps). Fixed
   so "current step" can be null when playback isn't within any defined
   step's range — overlay hides entirely, list highlighting does nothing,
   during those gaps. Shipped to production via cherry-pick as `93c50bd`.
7. **Version/build indicator** — small footer element showing the short
   Vercel git commit SHA + environment, linked to the GitHub commit, with a
   `local-dev` fallback for `npm run dev`. Confirmed working.
8. **Mobile control placement fix** — Repeat/Replay, "Loop this step," and
   Ingredients controls moved to the top of the scrollable steps area on
   phones (were too close to the bottom edge). Confirmed working by Joe on
   2026-07-22.
9. **Mic auto-off on phone lock** — voice control (`hooks/useVoiceCommands.js`)
   now stops listening automatically when the phone locks or the app is
   backgrounded (via the Page Visibility API), and requires the user to
   manually re-engage it afterward rather than silently auto-resuming.
   Verified live on a real phone (lock mid-command, unlock, mic stays off
   until manually restarted) via a Vercel preview deployment before merging.
   Confirmed by Joe, merged to `main` and pushed to production on
   2026-07-22 as part of the git divergence cleanup above.
10. **Ingredients pop-up now works on desktop/laptop** — turned out this was
    never actually built for desktop (button + panel were marked `md:hidden`
    since the feature's first commit, `db1a41c`) rather than a regression
    from the mobile control placement fix. Fix (`components/RecipePlayer.jsx`)
    added a real desktop Ingredients toggle button reusing the existing
    `setShowIngredients` state, no duplicated logic; mobile untouched.
    **Bonus fix found in the same pass:** the voice command matcher in
    `lib/voiceCommands.js` was too strict — phrasings like "show me the
    ingredients list" (with "the"/"list") weren't recognized, only exact
    "show ingredients"/"open ingredients." Broadened the regex to handle
    natural phrasing. Both verified live via preview deployment (desktop
    click test + voice command + mobile regression check) and merged to
    `main` on 2026-07-22.
11. **"Mark step done" + checkmark** — voice command "mark [step] done"
    (e.g. "mark chop garlic done"), reusing the existing fuzzy step-name
    matching in `lib/voiceCommands.js` (same matcher as "loop the sear
    meat part"), plus a plain "mark done" for whichever step is currently
    playing/active. Checkmark added to the left of each step in the
    scrollable steps list (`components/RecipePlayer.jsx`,
    `components/StepList.jsx`), independently clickable/toggleable, not
    just voice-driven. State is session-only (resets on reload), same
    lifecycle as the existing loop on/off state — no localStorage.
    Verified live with real speech on a Vercel preview deployment before
    merging, per the project's voice-control testing rule (see "Voice
    latency" below). Merged to `main` and pushed on 2026-07-23.
12. **New home page — full replacement, merged and LIVE in production
    2026-07-22** (`home-page-v2` branch, merged to `main` at `c6d2956` via
    clean fast-forward from `34a3b74`). Replaces the old plain recipe-menu
    home page entirely. See the full session-5 write-up below for how this
    was built and hardened — this entry is the shipped-and-confirmed
    summary. Confirmed live on the actual production URL
    (https://cook-with-joe.vercel.app, not a preview): light/cream
    Netflix-style hero with a tilted 20-image mosaic background, feature
    rows, and a real recipe grid (2 tiles/row on mobile, category filter
    bar including a live-only "Snacks" category not in local seed data —
    confirms it's genuinely reading production Blob data), header nav
    (Recipes/Upload/Pricing) intact, footer build indicator reads `c6d2956`.

## Session 5 — building the new home page (`home-page-v2`), full history

**Path to get here:**
1. `landing-test` — first exploration, dark/black-overlay Netflix-style
   concept, isolated route, parked (see write-up below). Superseded.
2. `landing-v2` — second exploration, light/cream Netflix-style concept,
   isolated route (`app/landing-v2/`), hero + feature rows + a placeholder
   "Popular Recipes" grid using 10 AI-generated stock food photos (from a
   local, not-yet-committed "recipe fpo tiles" folder, copied into
   `public/images/recipe-fpo/`, PNG→JPEG to cut ~25MB to ~2MB). Went
   through a three-round hero-mosaic bug fix saga (full detail preserved
   below) before being confirmed clean on desktop, phone landscape, and
   phone portrait.
3. `home-page-v2` — merged `landing-v2`'s design into the real
   `app/page.js`, replacing the old plain recipe-menu home page entirely,
   wired to live content instead of placeholders:
   - 10 more stock placeholder images (a–j, companion versions of the
     original 10 dishes) were added to the local "recipe fpo tiles"
     folder; all 20 processed into `public/images/recipe-fpo/` (4.3MB
     total) and used for the hero mosaic, cutting down repetition. This
     mosaic stays decorative/placeholder — deliberately not sourced from
     real recipe scraping (see decision note below).
   - The old "Popular Recipes" placeholder grid was replaced with the
     **real recipe catalog** — same fetch/category-filter logic as the
     old `app/page.js` (unchanged), rendered through a new `RecipeTile`
     component in landing-v2's visual language (vertical 2:3 tiles,
     gradient caption, cream/red-accent filter bar). Preserves all the
     old `RecipeCard` behavior (inactive recipes dimmed/non-clickable,
     premium badge, missing-thumbnail fallback icon) — verified via a
     temporary debug route feeding real seed data (deleted after). Real
     recipes link to `/recipe/[slug]`. Responsive: 2 tiles per row on
     mobile per Joe's direction, more columns on larger screens.
   - `RecipeCard.jsx` removed as dead code once nothing called it anymore
     — confirmed safe via a clean build (an import of a deleted file
     would have failed the build).
   - Header/footer: **restored** (not hidden like the isolated preview
     routes) — decision made explicitly with Joe since this is now the
     real home page and needs to keep Recipes/Upload/Pricing nav
     reachable, not stay full-bleed like a marketing splash page.
   - `/landing-v2` isolated route removed now that its content lives at
     `/`.
   - "Start Cooking" CTA: in-page smooth-scroll to the recipe section
     (`#recipes`) rather than a route change — this had its own bug fix
     saga, see below.
   - **Decision made with Joe:** no scraping of external recipe sites for
     mosaic/catalog filler, even for dev purposes — flagged as a real
     copyright/rights question (preview URLs are still publicly
     reachable), and the project's own roadmap already has the *correct*
     way to bring in external recipes later (Phase 4/5: paste-a-URL
     structured-data/LLM extraction, landing as a draft for review before
     publish, with attribution). Went with more AI-generated placeholder
     photos instead — fast, no rights issue, purely decorative.

### "Start Cooking" scroll bug — three-round fix saga, resolved

Found via direct JS inspection (`window.scrollY` / `window.location.hash`
before and after a click), not a screenshot — clicking "Start Cooking"
(`<a href="#recipes">`) did nothing: hash stayed empty, scroll barely
moved.

**Fix attempt 1** (`scrollIntoView({behavior: 'smooth'})`, verified only via
a same-origin iframe test harness): reported fixed, but **broken when
re-checked directly against the actual deployed preview URL** — harness
verification isn't trustworthy, same lesson as the mosaic saga below.

**Fix attempt 2** (`window.scrollTo({top, behavior: 'smooth'})` with an
instant-jump fallback if scroll position hasn't moved ~400ms after the
attempt): this Cowork session's own automated Chrome browser tool also
read it as broken (`scrollY` stuck at 0 after a dispatched click, no
console errors) — but investigating further surfaced the real explanation
and closed this out:
- **Vercel Deployment Protection** (see Architecture section above) means
  no automated/unauthenticated tool — including Claude Code's own iframe
  harness and curl — can actually reach preview URLs at all. Claude Code's
  direct curl attempt confirmed an unconditional redirect to Vercel's SSO
  login for every request.
- With the real deployed URL unreachable programmatically, verification
  fell back to three independent, non-harness checks instead: (1) **Joe
  clicked the real button on the real deployed preview in both Safari and
  Chrome on his own Mac — worked correctly both times.** (2) Claude Code
  built and ran the actual production bundle locally (`next build && next
  start`, real minification, not dev mode) and dispatched a full realistic
  event sequence (pointerdown/mousedown/pointerup/mouseup/click) via
  Chrome DevTools Protocol directly against the real rendered button — no
  iframe, no harness — and confirmed `scrollY` moved correctly, both at
  normal timing and specifically ~30ms after page load (testing a
  hydration-timing hypothesis directly). All three checks agreed: **the
  fix works.**
- This Cowork session's own automated-click discrepancy (scrollY not
  moving) is now understood as a **testing-tool artifact**, not a real
  bug — its synthetic click apparently doesn't reliably trigger this
  specific handler the way a real user gesture or a full realistic event
  sequence does.

**New testing-tool limitations to remember** (alongside the existing
sub-500px headless-screenshot limitation):
- This Cowork session's automated Chrome browser tool can fail to trigger
  click-driven `scrollTo`/`scrollIntoView` handlers even when a real
  click works fine — don't trust a "still broken" verdict from it alone
  for this class of bug; get a real human click confirmation first.
- Preview URLs (`*-cook-with-joe.vercel.app`) are behind Vercel's SSO wall
  and unreachable by any unauthenticated automated tool (curl, a bare
  fetch, Claude Code's own iframe harness). Production
  (`cook-with-joe.vercel.app`) is not — automated checks against the real
  production URL work fine once something is actually merged and deployed.

## landing-v2 hero mosaic — three-round bug fix saga (historical, folded into home-page-v2 above)

The first build's hero had two real issues caught in live review (desktop
Safari + phone), not simulation:
- Hero text (headline/subhead/CTA) was hard to read against the busy tiled
  photo background — insufficient contrast/scrim.
- The tile background rendered as a single tilted row, not a continuous
  tiled mosaic plane like the Netflix reference.

**Round 1 fix:** added a soft cream radial scrim behind the text block, and
rebuilt the tile grid as a full-height multi-row mosaic (10 cols × 6 rows,
also fixing a repeat-pattern bug where every column showed the same photo
down all 6 rows). Verified clean on desktop (including a zoomed contrast
check) and phone landscape.

**Round 2 — portrait-phone-only regression found:** phone in portrait
showed the tile mosaic clustered in dense bands at the top and bottom with
a large empty gap through the middle where the text sits — landscape and
desktop were unaffected. Root cause: `heroGrid` used a fixed
`repeat(10, ...)` column count, so tile size (and via `aspect-ratio`, tile
height) was derived purely from viewport width. On a narrow portrait phone
tiles shrank drastically while the grid box's own height (tied to a
vh-based hero min-height) stayed as tall as desktop, leaving CSS Grid's
row-stretch behavior to scatter the leftover space as gaps.

**Round 2 fix (attempted, then found broken):** switched to
`repeat(auto-fill, minmax(140px, 1fr))` + `align-content: start` + raised
tile supply to 150. Verified only via headless-Chrome screenshots at
500×1100/1440×900/844×390 — the tool doesn't reliably honor widths below
~500px, so no true ~390px render was directly checked. **This "verified"
fix was actually broken on a real phone in portrait**: tiles rendered as
tall, heavily overlapping vertical strips, illegible. Root cause (worked
out mathematically after the live failure): at real 390px width, only 3
columns fit, producing 50 rows of content at ~12,675px real height against
a declared box height of only ~1009px. `transform-origin` pivots from the
element's own border box, not overflowing content, so an 8° rotation
displaced far-away rows by thousands of pixels sideways — a geometry bug,
not per-tile rotation (the rotate/scale transform applies once, rigidly,
to the whole grid).

**Round 3 fix (final):** `heroTile` now uses a fixed 150×225px footprint
(no `aspect-ratio`), `grid-auto-rows` is a fixed 225px, and a new
`HeroTileMosaic` component measures its own wrapper box at runtime
(`getBoundingClientRect` + `ResizeObserver`) to compute the exact
columns/rows needed instead of a static "generous guess" total — at 390px
this now needs only ~5×6=30 tiles with a controlled ~1.4x content overflow,
matching desktop's own modest overflow instead of the previous ~12.5x
runaway. **Confirmed clean by Joe on a real phone held upright in
portrait, plus phone landscape and desktop — no overlap, no gaps, legible
text throughout.**

**Lesson reinforced (same one as the voice-control history below):**
headless-Chrome screenshot verification below ~500px width is not
trustworthy for narrow-viewport layout bugs — round 2's regression shipped
as "verified" on proxy dimensions and broke on a real device. Live
device testing is required for any layout claim about phone portrait,
same as voice-control changes require live-mic testing. (This same
"don't trust the harness/proxy, check the real thing" lesson resurfaced
twice more in the Start Cooking scroll bug above.)

## Landing page exploration v1 — dark concept, built, isolated, parked, superseded

Explored a Netflix-inspired dark landing page concept (endless vertical
recipe grid, dark overlays, tilted hero photo collage). Iterated through:
copy ("A World of Recipes, At Your Pace." / "Step-by-step, hands-free recipe
perfection."), then real AI-generated photorealistic lifestyle food photos
(12 dishes — ribeye, shrimp, pasta, roast chicken, tiramisu, salmon,
margarita, short rib, risotto, tacos, lava cake, street corn) replacing the
gradient placeholders, tiled/tilted in the hero background like the Netflix
reference, labels removed per Joe's request (photos only).

**Ported into the real app** as an isolated test route:
- New files only: `app/landing-test/page.js` + 12 images under
  `public/images/hero-mockup/`. **Zero existing files touched** (confirmed
  via `git status`) — not linked from the real home page or nav, only
  reachable by visiting `/landing-test` directly.
- Claude Code caught two real bugs while porting: a broken `tints` array
  reference (would've crashed the thumbnail grid) and a CSS class collision
  with `app/globals.css`'s own `.eyebrow` class (fixed via CSS Modules
  scoping).
- Pushed to its own `landing-test` branch (not main), confirmed isolated,
  Vercel preview deployment triggered successfully. **Superseded — the real
  home page now ships as `home-page-v2`/`landing-v2`'s design, live in
  production.**

## ✅ Session 6 cleanup (2026-07-23)

- **Dropped the dead `landing-test` branch** (local and origin) — its
  content was fully superseded by `home-page-v2`, which is what actually
  shipped to production. Confirmed not merged into `main` before deletion.
- **Removed the stray `landing-mockup-reference.html`** file that had been
  sitting untracked at the repo root since the landing-test exploration —
  confirmed no code referenced it before deleting.
- **Recreated this file (`claude/dev-status-log.md`) in the repo** — it had
  existed only as a doc in the linked Claude Project, not as an actual
  tracked file in git. Seeded here from that source so it's now the
  single source of truth going forward; Joe should keep the Claude Project
  copy in sync manually when this file changes materially, or ask Claude
  to re-sync it.
- `origin/main` confirmed clean and in sync after both deletions.

## Pre-existing bug found (not caused by any recent work)

Local dev's home page shows "No recipes in this category yet" — root cause:
`lib/recipesStore.js` uses Vercel Blob's `head()`, which throws because this
project's Blob store has OIDC enabled but the trust policy only covers
Preview/Production environments, not local Development. `app/page.js`'s
fetch chain has **no `.catch()`**, so the resulting 500/empty-body response
throws on `.json()` silently — `recipeData` never updates, `loading` still
flips to false, and the UI shows a misleading empty state instead of any
error indication. This is also what was tripping the dev-overlay's "1 Issue"
indicator (an unhandled promise rejection, same root cause). This affected
the `home-page-v2` work too (Claude Code's local testing of the recipe
grid saw an empty catalog for this same reason) — not a flaw in that work.

- **Confirmed NOT an issue for Preview or Production** — OIDC trust policy
  includes those environments, so preview deployments and production can
  read real Blob data fine. Only local `npm run dev` is affected.
- **Fix for local dev (Joe's action, dashboard step):** grab a
  `BLOB_READ_WRITE_TOKEN` from Vercel → Storage → the Blob store →
  Quickstart/`.env.local` tab, add it to local `.env.local`. Token auth
  bypasses the OIDC trust-policy check entirely. **Not done yet.**
- **Real bug worth fixing regardless:** the missing `.catch()` means ANY
  future API failure (not just this OIDC quirk) would silently show real
  users a false "no recipes" empty state instead of an error message. A fix
  was offered (add proper error handling/error state) but not yet actioned.

## Voice latency — intentionally left as-is, real fix identified

Root cause: Chrome's `SpeechRecognition` with `interimResults: false` +
`continuous: true` waits for full server-side finalization before `onresult`
fires — a multi-second delay entirely in the browser's cloud round-trip, not
app code. Confirmed this won't worsen over time on its own (fixed ceiling,
doesn't compound with recipe/content growth).

A first fix attempt (interim results + debounce + double-fire guard) was
pushed to production after only simulated (non-live-mic) verification, and
broke voice control almost entirely (only "play" worked). **Reverted and
confirmed restored.** Lesson applied: no more simulation-only verification
for voice-control changes — needs live testing with real speech going
forward. (Applied successfully twice more since: the mic-auto-off feature
and the ingredients voice-regex fix were both verified live before merging.
Same lesson resurfaced repeatedly during the home-page-v2 work above.)

**Real fix identified, not yet started:** Chrome 139+ ships genuine
on-device speech recognition via the same `SpeechRecognition` API
(`processLocally: true` + `SpeechRecognition.available()`/`.install()`) —
eliminates the network round-trip entirely. Chrome-only for now; would need
feature detection with a cloud-based fallback for other browsers.

## Feature backlog — voice "mark step done" + deferred bake-timer prompt

Pitched by Joe 2026-07-22. Two related but independently shippable pieces:

**1. ~~"Mark step done" + checkmark~~ — Done 2026-07-23.** Built on a
`mark-step-done` branch off `main`: voice command "mark [step] done"
(e.g. "mark chop garlic done"), reusing the existing fuzzy step-name
matching already used by "loop the sear meat part" / "play the sear meat
part again" in `lib/voiceCommands.js` rather than building new matching
from scratch, plus a simpler "mark done" for the current step. Checkmark
added to the left of each step in the scrollable steps list
(`components/RecipePlayer.jsx`, `components/StepList.jsx`), toggleable
by click too, not just voice. State is session-only (resets on reload),
same lifecycle as the existing loop on/off state — left as a default to
revisit if Joe wants it to persist instead (e.g. localStorage per
recipe). Verified live with real speech on a Vercel preview deployment
before merging (no simulation-only verification, per the "Voice latency"
lesson below). Merged to `main` and pushed. See entry 11 under "Features
shipped and confirmed working in production" above.

**2. Bake-timer prompt — deferred as a "nice to have," design settled for
whenever it's picked up.** Went through two trigger designs before
landing on the final one:
- First idea: prompt fires automatically the moment a timer-flagged step
  starts playing. Rejected — too passive, would fire on any entry into
  the step including scrubbing back/replaying/looping, not just the
  actual "I just put it in the oven" moment.
- **Final design: the timer prompt requires the user to explicitly mark
  the timer-flagged step done first** (depends on feature 1 above being
  built) — checking off "Place in oven, bake for 20 minutes" is the
  deliberate signal that triggers the offer, not just reading/playing
  that step.
- Publisher side: a new "Timer prompt (minutes)" field per step in
  `ChapterEditor.jsx` — publisher types the check-in number directly
  (e.g. 18 for a 20-minute bake), no auto-parsing of the step's own
  direction text for v1 (that's a nice v2 polish, adds real text-parsing
  complexity, better done once the manual version's proven useful).
- On confirm (voice or click): starts a real countdown, shown as a small
  persistent on-screen indicator, doesn't block other navigation.
- On completion: audio chime + a browser Notification if permission is
  available.
- **Scoped to foreground-only for v1** — does not need to survive the
  phone locking or the tab backgrounding. A locked-phone-surviving timer
  needs real Service Worker + Push API infrastructure (a meaningfully
  bigger, separate build) — worth bundling with the Phase 1 backend work
  rather than doing standalone. Notably in tension with the already-shipped
  mic-auto-off-on-lock feature, which deliberately stops on lock rather
  than continuing invisibly — a timer is the opposite instinct (should
  probably keep counting through a lock), which is exactly why doing this
  properly is bigger than a quick add-on.

Pick this up once feature 1 has shipped and Joe's ready to revisit it.

## Phase 1 planning — plan received, key decisions still open

Full implementation plan received (schema, auth, Stripe Connect, premium
enforcement, migration path) — still not started. Open decisions:

- **Database:** Neon (recommended) vs. Supabase. **Not finalized.**
- **Auth:** Auth.js/NextAuth v5 (recommended) vs. Clerk. **Not finalized.**
- **Payments:** Stripe Connect, Express accounts (decided). Joe should run
  his own account through Express onboarding to exercise the real flow.
- **Premium enforcement gap:** `premium: true` recipes currently leak their
  real video URL to anonymous callers via `/api/recipes` — must fix as part
  of Phase 1.
- **Schema sketch:** `users` (role: viewer/chef), `chef_profiles` (Stripe
  Connect info), `recipes` (real `owner_id` FK, JSONB ingredients/tips/steps),
  `entitlements` (generic, supports per-recipe or per-chef/platform access).
- **Migration path:** from live Blob data, `lib/recipesStore.js` kept as
  rollback path through one deploy cycle, cutover contained to
  `lib/recipes.js` internals only.

**Signup checklist (not yet done):**
- [ ] Neon account via Vercel Marketplace (or Supabase)
- [ ] Stripe account + enable Connect, "Marketplace" profile, Joe's own
      Express onboarding
- [ ] Clerk account (only if Clerk chosen over Auth.js)

## Next steps

1. ~~Drop the `landing-test` branch and clean up the stray
   `landing-mockup-reference.html` file at the repo root.~~ **Done 2026-07-23**
   — see Session 6 cleanup above.
2. ~~Build "mark step done" + checkmark~~ (feature backlog item 1 above)
   **Done 2026-07-23** — verified live with real speech on a preview
   deployment, merged to `main` and pushed. See "Feature backlog" above.
3. Optional cleanup: add `BLOB_READ_WRITE_TOKEN` to `.env.local` for local
   dev, and/or fix the missing `.catch()` in `app/page.js`.
4. Decide whether to pursue Chrome's on-device speech recognition.
5. Decide Neon vs. Supabase and Auth.js vs. Clerk for Phase 1, then work
   through the signup checklist and kick off implementation.
6. Revisit the bake-timer prompt (feature backlog item 2 above) now that
   "mark step done" has shipped.
