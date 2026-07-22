"use client";

import { useEffect } from "react";
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

// The tilted background wall wants more tiles than the 10 source images —
// repeat the set rather than stretching or distorting individual photos to
// fill the grid. heroGrid's CSS now sizes columns by a fixed pixel floor
// (auto-fill/minmax) rather than a fixed count, so the real column count —
// and therefore how many rows are needed to cover the grid's full height —
// varies per viewport (fewer, wider columns and more rows on a tall
// portrait phone; more, narrower columns and fewer rows on a wide
// desktop). 150 is a generous fixed supply sized for the tallest/widest
// realistic combination (e.g. a tall portrait phone needs more rows; a
// wide desktop needs more columns) — any surplus beyond what a given
// viewport needs just overflows past the grid's own box and is clipped by
// .hero's overflow:hidden, same as the rotation/scale buffer already is.
const HERO_TILE_COUNT = 150;
// Plain `i % RECIPE_TILES.length` would repeat the exact same image straight
// down every column (index only depends on column position, never row).
// Shifting by a per-row offset instead spreads repeats out so a column
// doesn't show the same photo twice in a row. The real column count is
// runtime/viewport-dependent now (see heroGrid's auto-fill above), so this
// assumes a representative width of 10 purely for shuffling variety, not
// as a claim about the actual rendered column count.
const HERO_SHUFFLE_WIDTH = 10;
const heroTiles = Array.from({ length: HERO_TILE_COUNT }, (_, i) => {
  const row = Math.floor(i / HERO_SHUFFLE_WIDTH);
  return RECIPE_TILES[(i + row * 3) % RECIPE_TILES.length];
});

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
        <div className={styles.heroGridWrap} aria-hidden="true">
          <div className={styles.heroGrid}>
            {heroTiles.map((tile, i) => (
              <div className={styles.heroTile} key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative background wall, not a next/image candidate */}
                <img src={`/images/recipe-fpo/${tile.file}`} alt="" />
              </div>
            ))}
          </div>
        </div>
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
