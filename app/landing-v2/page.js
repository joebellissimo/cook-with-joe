"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import styles from "./landing.module.css";

// Display serif for the hero/section headlines only — the rest of the app
// uses --font-sans (Jost) throughout, so this is scoped to this route via
// the .variable className below rather than touching the shared font setup
// in app/layout.js.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

const RECIPE_TILES = [
  { file: "spring-citrus-salad.jpg", title: "Spring Citrus Salad" },
  { file: "green-goddess-pasta.jpg", title: "Creamy Green Goddess Pasta" },
  { file: "tomato-burrata-toast.jpg", title: "Roasted Tomato Burrata Toast" },
  { file: "rainbow-veggie-grain-bowl.jpg", title: "Rainbow Veggie Grain Bowl" },
  { file: "summer-peach-caprese.jpg", title: "Summer Peach Caprese" },
  { file: "crispy-cauliflower-tacos.jpg", title: "Crispy Cauliflower Tacos" },
  { file: "lemon-blueberry-yogurt-cake.jpg", title: "Lemon Blueberry Yogurt Cake" },
  { file: "coconut-mango-chia-parfait.jpg", title: "Coconut Mango Chia Parfait" },
  { file: "herby-white-bean-soup.jpg", title: "Herby White Bean Soup" },
  { file: "strawberry-shortcake-overnight-oats.jpg", title: "Strawberry Shortcake Overnight Oats" },
];

// Fixed pixel footprint, not aspect-ratio/column-width-derived: a previous
// attempt sized tiles via CSS aspect-ratio against an auto-fill column
// width, so tile height shrank on narrow viewports while a single static
// total tile count stayed fixed — on a narrow phone, few columns fit,
// forcing far more rows than the box was actually tall, so the grid's real
// content height ended up many times taller than its own declared box.
// transform-origin computes from that declared box, not the overflowing
// content, so rotating pushed distant rows sideways by huge, wildly
// inconsistent amounts — visible as overlapping vertical strips rather
// than a clean tiled field. Fixed px dimensions here, sized to the actual
// measured wrap box in the HeroTileMosaic component below, keep row/column
// counts proportional to the real viewport at any aspect ratio.
const HERO_TILE_WIDTH = 150;
const HERO_TILE_HEIGHT = 225;
// Must match heroGrid's CSS `gap: 0.75rem` (assumes the standard 16px root
// font-size, unchanged elsewhere in this project).
const HERO_TILE_GAP = 12;

// Plain `i % RECIPE_TILES.length` would repeat the exact same image straight
// down every column (index only depends on column position, never row).
// Shifting by a per-row offset instead spreads repeats out so a column
// doesn't show the same photo twice in a row.
function tileForIndex(i, cols) {
  const row = Math.floor(i / cols);
  return RECIPE_TILES[(i + row * 3) % RECIPE_TILES.length];
}

// Measures its own wrapper box (already sized by heroGridWrap's CSS inset)
// and computes exactly how many fixed-footprint columns/rows are needed to
// cover it, rather than guessing one static total tile count for every
// viewport. Renders nothing until the first measurement — a brief blank
// beat on a decorative background is preferable to a wrong-shaped flash.
function HeroTileMosaic() {
  const wrapRef = useRef(null);
  const [grid, setGrid] = useState(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const measure = () => {
      const { width, height } = wrap.getBoundingClientRect();
      // +1 on each axis is a small rounding/timing safety margin, not a
      // coverage guess — the fit itself is computed exactly from the
      // measured box.
      const cols = Math.max(1, Math.ceil((width + HERO_TILE_GAP) / (HERO_TILE_WIDTH + HERO_TILE_GAP)) + 1);
      const rows = Math.max(1, Math.ceil((height + HERO_TILE_GAP) / (HERO_TILE_HEIGHT + HERO_TILE_GAP)) + 1);
      setGrid({ cols, rows });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.heroGridWrap} aria-hidden="true" ref={wrapRef}>
      {grid && (
        <div
          className={styles.heroGrid}
          style={{ gridTemplateColumns: `repeat(${grid.cols}, ${HERO_TILE_WIDTH}px)` }}
        >
          {Array.from({ length: grid.cols * grid.rows }, (_, i) => {
            const tile = tileForIndex(i, grid.cols);
            return (
              <div className={styles.heroTile} key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative background wall, not a next/image candidate */}
                <img src={`/images/recipe-fpo/${tile.file}`} alt="" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LandingV2Page() {
  // The real SiteHeader/SiteFooter (rendered by the shared root
  // app/layout.js around every route) would otherwise double up with this
  // page's own hero nav-less layout. Hiding them only while this page is
  // mounted, via direct style manipulation restored on cleanup, keeps every
  // other route untouched with no edits to layout.js/SiteHeader.jsx/
  // SiteFooter.jsx. They're direct children of <body> per layout.js's
  // structure, which is what makes this selector precise.
  useEffect(() => {
    const header = document.querySelector("body > header");
    const footer = document.querySelector("body > footer");
    const prevHeaderDisplay = header?.style.display ?? "";
    const prevFooterDisplay = footer?.style.display ?? "";
    if (header) header.style.display = "none";
    if (footer) footer.style.display = "none";
    return () => {
      if (header) header.style.display = prevHeaderDisplay;
      if (footer) footer.style.display = prevFooterDisplay;
    };
  }, []);

  return (
    <div className={`${styles.page} ${fraunces.variable}`}>
      {/* ---------- Hero ---------- */}
      <section className={styles.hero}>
        <HeroTileMosaic />
        <div className={styles.heroOverlay} aria-hidden="true" />

        <div className={styles.heroContent}>
          <p className={`eyebrow ${styles.heroEyebrow}`}>Cook With Joe</p>
          <h1 className={styles.headline}>
            Cook with your hands full, not your phone.
          </h1>
          <p className={styles.subhead}>
            Every recipe is a step-by-step video you control with your voice.
            Say &ldquo;next step,&rdquo; and keep chopping, stirring, and
            searing without ever touching a screen.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/" className={styles.ctaButton}>
              Start Cooking
            </Link>
          </div>
          <p className={styles.ctaHint}>
            Free to use — no account needed.
          </p>
        </div>
      </section>

      {/* ---------- Feature rows ---------- */}
      <section className={styles.features}>
        <div className={styles.featureRow}>
          <div className={styles.featureText}>
            <h2 className={styles.featureTitle}>Cook from any screen</h2>
            <p className={styles.featureBody}>
              Prop up your laptop, tablet, or phone on the counter — Cook
              With Joe works the same everywhere, so the recipe is always
              wherever you happen to be standing.
            </p>
          </div>
          <div className={styles.featureVisual}>
            <div className={styles.deviceStack}>
              <div className={styles.deviceLaptop}>
                <div className={styles.deviceScreen}>💻</div>
              </div>
              <div className={styles.deviceTablet}>
                <div className={styles.deviceScreen}>📱</div>
              </div>
              <div className={styles.devicePhone}>
                <div className={styles.deviceScreen}>📲</div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.featureRow} ${styles.featureRowReverse}`}>
          <div className={styles.featureText}>
            <h2 className={styles.featureTitle}>Just say the word</h2>
            <p className={styles.featureBody}>
              Hands-free, on purpose. Say &ldquo;next step,&rdquo; &ldquo;loop
              this step,&rdquo; or &ldquo;show me the ingredients&rdquo; and
              the video keeps up — no pausing to wipe your hands and tap a
              button.
            </p>
          </div>
          <div className={styles.featureVisual}>
            <div className={styles.voiceCard}>
              <div className={styles.voiceMicRow}>
                <div className={styles.voiceMicDot}>🎙️</div>
                <div className={styles.voiceWave} aria-hidden="true">
                  {[6, 14, 20, 10, 16, 8, 18, 12].map((h, i) => (
                    <span key={i} style={{ height: `${h}px` }} />
                  ))}
                </div>
              </div>
              <div className={styles.voicePhrases}>
                <span className={styles.voicePhrase}>&ldquo;next step&rdquo;</span>
                <span className={styles.voicePhrase}>&ldquo;loop this step&rdquo;</span>
                <span className={styles.voicePhrase}>&ldquo;show me the ingredients&rdquo;</span>
                <span className={styles.voicePhrase}>&ldquo;repeat that&rdquo;</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.featureRow}>
          <div className={styles.featureText}>
            <h2 className={styles.featureTitle}>
              Recipes that follow along
            </h2>
            <p className={styles.featureBody}>
              Every recipe is chaptered into short video steps synced to the
              direction you&apos;re on, with an ingredients checklist you can
              tick off without ever picking up your phone.
            </p>
          </div>
          <div className={styles.featureVisual}>
            <div className={styles.stepsCard}>
              <div className={`${styles.stepRow} ${styles.stepRowActive}`}>
                <span className={styles.stepDot}>2</span>
                Heat the pan
              </div>
              <div className={styles.stepRow}>
                <span className={styles.stepDot}>3</span>
                Sauté the onions
              </div>
              <div className={styles.stepRow}>
                <span className={styles.stepDot}>4</span>
                Add the garlic
              </div>
              <div className={styles.stepDivider} />
              <div className={styles.ingredientRow}>
                <span className={`${styles.ingredientCheck} ${styles.ingredientChecked}`}>✓</span>
                2 large yellow onions
              </div>
              <div className={styles.ingredientRow}>
                <span className={styles.ingredientCheck} />
                3 cloves garlic
              </div>
              <div className={styles.ingredientRow}>
                <span className={styles.ingredientCheck} />
                1 can crushed tomatoes
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Popular recipes grid ---------- */}
      <section className={styles.popular}>
        <h2 className={styles.popularHeading}>Popular Recipes</h2>
        <div className={styles.popularGrid}>
          {RECIPE_TILES.map((tile) => (
            <Link href="/" key={tile.file} className={styles.popularTile}>
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed local placeholder assets, no next/image config needed */}
              <img src={`/images/recipe-fpo/${tile.file}`} alt={tile.title} />
              <span className={styles.popularCaption}>{tile.title}</span>
            </Link>
          ))}
        </div>
        <div className={styles.popularFooter}>
          <Link href="/" className={styles.secondaryButton}>
            Browse All Recipes
          </Link>
        </div>
      </section>
    </div>
  );
}
