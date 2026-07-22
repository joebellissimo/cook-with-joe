"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./landing.module.css";

// Ported from landing-mockup-reference.html — same 12 AI-generated photos,
// now served locally from public/images/hero-mockup/ instead of the
// original CDN URLs.
const heroDishes = [
  { name: "Seared Ribeye", url: "/images/hero-mockup/seared-ribeye.png" },
  { name: "Garlic Butter Shrimp", url: "/images/hero-mockup/garlic-butter-shrimp.png" },
  { name: "Tomato Basil Pasta", url: "/images/hero-mockup/tomato-basil-pasta.png" },
  { name: "Charred Street Corn", url: "/images/hero-mockup/charred-street-corn.png" },
  { name: "Herb Roast Chicken", url: "/images/hero-mockup/herb-roast-chicken.png" },
  { name: "Tiramisu", url: "/images/hero-mockup/tiramisu.png" },
  { name: "Grilled Salmon", url: "/images/hero-mockup/grilled-salmon.png" },
  { name: "Margarita", url: "/images/hero-mockup/margarita.png" },
  { name: "Braised Short Rib", url: "/images/hero-mockup/braised-short-rib.png" },
  { name: "Mushroom Risotto", url: "/images/hero-mockup/mushroom-risotto.png" },
  { name: "Fish Tacos", url: "/images/hero-mockup/fish-tacos.png" },
  { name: "Chocolate Lava Cake", url: "/images/hero-mockup/chocolate-lava-cake.png" },
];

const MOSAIC_TILE_COUNT = 42;

const titles = [
  "Quick Onion Pasta Sauce", "Pan-Seared Steak", "Classic Meatballs", "Buffalo Wings",
  "Margarita, Done Right", "Tiramisu", "Garlic Butter Shrimp", "Street Tacos",
  "Roast Chicken", "Vegetarian Chili", "Whiskey Sour", "Chocolate Lava Cake",
  "Beef Bourguignon", "Crispy Pork Belly", "Caprese Salad", "Seared Scallops",
  "Homemade Ramen", "Grilled Salmon", "Mushroom Risotto", "Old Fashioned",
  "Lemon Tart", "Pulled Pork", "Shrimp Ceviche", "Espresso Martini",
  "Braised Short Rib", "Stuffed Peppers", "Panna Cotta", "Fish Tacos",
  "Negroni", "Apple Galette",
];
const cats = ["Meats", "Appetizers", "Cocktails", "Desserts", "Vegetarian"];
const emos = ["🍝", "🥩", "🍖", "🍗", "🍹", "🍰", "🍤", "🌮", "🍲", "🥗", "🍣", "🧁", "🍷", "🥘", "🍕", "🥪"];
// The reference mockup's script references a `tints` array for the
// thumbnail placeholder gradients but never actually defines one — a bug
// in the mockup that would throw and break the whole grid. Defined here.
const tints = [
  "#3a2a20", "#20241f", "#2a1f2e", "#1f2a2e", "#2e2a1f",
  "#241f2a", "#1f2e28", "#2e1f24", "#242e1f", "#1f242e",
];

const thumbs = titles.map((title, i) => ({
  title,
  category: cats[i % cats.length],
  emoji: emos[i % emos.length],
  c1: tints[i % tints.length],
  c2: tints[(i + 3) % tints.length],
  ar: i % 5 === 0 ? "3/4" : i % 3 === 0 ? "1/1" : "2/3",
  premium: i % 4 === 1,
  steps: 3 + (i % 6),
}));

export default function LandingTestPage() {
  const [navSolid, setNavSolid] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const thumbRefs = useRef([]);

  // Nav goes solid past a short scroll threshold, same as the mockup.
  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fade-in-on-scroll for the thumbnail grid — ported as direct classList
  // manipulation via refs (same mechanism as the original vanilla JS)
  // rather than per-item React state, since it's a one-time, one-directional
  // entrance animation with no need to ever re-render on scroll.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add(styles.in);
        });
      },
      { threshold: 0.1 }
    );
    thumbRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // Replaces the mockup's `html { scroll-behavior: smooth }` — scoped to
  // this page's own in-page anchor links instead of a global page-wide
  // behavior change.
  const scrollToId = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // The real SiteHeader/SiteFooter (rendered by the shared root
  // app/layout.js around every route) would otherwise double up with this
  // mockup's own nav/footer. Hiding them only while this page is mounted —
  // via direct style manipulation, restored on cleanup — keeps every other
  // route completely untouched, with no changes to layout.js/
  // SiteHeader.jsx/SiteFooter.jsx themselves. (An earlier attempt at this
  // used <style jsx global>, but that didn't actually take effect under
  // this project's Turbopack setup — direct DOM manipulation is more
  // reliable and easier to verify.) They're direct children of <body> per
  // layout.js's structure, which is what makes `body > header`/
  // `body > footer` a precise, collision-free selector — this page's own
  // <footer> is nested inside <main>, several levels deeper.
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
    <div className={styles.page}>
      <nav className={`${styles.nav} ${navSolid ? styles.solid : ""}`}>
        <div className={styles.logo}>
          COOK WITH <span>JOE</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#recipes" onClick={(e) => scrollToId(e, "recipes")}>
            Recipes
          </a>
          <a href="#voice" onClick={(e) => scrollToId(e, "voice")}>
            Voice Control
          </a>
          <a href="#">Pricing</a>
          <a href="#" className={styles.navCta}>
            Sign In
          </a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroBg}></div>
        <div className={styles.heroMosaic}>
          {Array.from({ length: MOSAIC_TILE_COUNT }, (_, i) => heroDishes[i % heroDishes.length]).map(
            (dish, i) => (
              <div
                key={i}
                className={styles.tile}
                style={{ "--photo": `url('${dish.url}')` }}
              />
            )
          )}
        </div>
        <div className={styles.heroScrim}></div>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>Hands-Free Cooking, Reimagined</span>
          <h1>
            A World of Recipes, <em>At Your Pace.</em>
          </h1>
          <p>Step-by-step, hands-free recipe perfection.</p>
          <div className={styles.heroCtas}>
            <a href="#recipes" className={`${styles.btn} ${styles.btnPrimary}`} onClick={(e) => scrollToId(e, "recipes")}>
              Browse Recipes
            </a>
            <a href="#voice" className={`${styles.btn} ${styles.btnGhost}`} onClick={(e) => scrollToId(e, "voice")}>
              See Voice Control
            </a>
          </div>
          <div className={styles.heroSub}>Free to start · Works on phone, tablet &amp; laptop</div>
        </div>
        <div className={styles.scrollCue}>Scroll ↓</div>
      </section>

      <div className={styles.features}>
        <div className={styles.featureCard}>
          <span className={styles.ico}>🎙️</span>
          <h3>Voice-Controlled</h3>
          <p>&ldquo;Next step.&rdquo; &ldquo;Loop the sear.&rdquo; &ldquo;Show me the ingredients.&rdquo; Your voice runs the show.</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.ico}>🔁</span>
          <h3>Loop Any Technique</h3>
          <p>Repeat the tricky part as many times as you need — full speed or half speed.</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.ico}>🎬</span>
          <h3>Step-Tagged Video</h3>
          <p>Every recipe is chaptered to the exact moment each step begins. Jump straight there.</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.ico}>✅</span>
          <h3>Live Checklist</h3>
          <p>Check off ingredients and steps out loud as you go — no screen-touching required.</p>
        </div>
      </div>

      <section className={styles.section} id="recipes" style={{ marginTop: 20 }}>
        <div className={styles.sectionHead}>
          <h2>An Entire World of Recipes</h2>
          <p>New chapters added every week</p>
        </div>
        <div className={styles.pills}>
          {["All", ...cats].map((cat) => (
            <div
              key={cat}
              className={`${styles.pill} ${activeCategory === cat ? styles.active : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </div>
          ))}
        </div>
        <div className={styles.gridWrap}>
          <div className={styles.thumbGrid}>
            {thumbs.map((t, i) => (
              <div
                key={i}
                ref={(el) => (thumbRefs.current[i] = el)}
                className={styles.thumb}
                style={{ "--c1": t.c1, "--c2": t.c2, "--ar": t.ar }}
              >
                <div className={styles.thumbMedia}>
                  {t.emoji}
                  <div className={styles.thumbBadges}>
                    <span className={styles.badge}>{t.steps} steps</span>
                    {t.premium && <span className={`${styles.badge} ${styles.premium}`}>★ Premium</span>}
                  </div>
                  <div className={styles.playDot}>▶</div>
                  <div className={styles.thumbOverlay}>
                    <div className={styles.thumbTitle}>{t.title}</div>
                    <div className={styles.thumbMeta}>{t.category}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.fadeOut}>
            <div className={styles.inner}>
              <p>This is just the beginning of the library.</p>
              <a href="#" className={`${styles.btn} ${styles.btnPrimary}`}>
                Start Cooking
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.voiceSection} id="voice">
        <div className={styles.voiceCopy}>
          <span className={styles.eyebrow}>Say the Word</span>
          <h2>Cook Without Ever Touching a Screen</h2>
          <p>
            Flour on your hands, water running, timer going — none of it matters. Cook With Joe
            listens for the moment you need it and responds instantly.
          </p>
          <ul className={styles.voiceList}>
            <li>&ldquo;Next step&rdquo; / &ldquo;Previous step&rdquo;</li>
            <li>&ldquo;Loop the sear meat part&rdquo;</li>
            <li>&ldquo;Play that again at half speed&rdquo;</li>
            <li>&ldquo;Show me the ingredients list&rdquo;</li>
            <li>&ldquo;Check off add salt&rdquo;</li>
            <li>&ldquo;Start from the beginning&rdquo;</li>
          </ul>
        </div>
        <div className={styles.chatMock}>
          <div className={`${styles.bubble} ${styles.user}`}>&ldquo;Loop the sear meat part&rdquo;</div>
          <div className={`${styles.bubble} ${styles.system}`}>🔁 Looping — Sear the Meat</div>
          <div className={`${styles.bubble} ${styles.user}`}>&ldquo;Play at half speed&rdquo;</div>
          <div className={`${styles.bubble} ${styles.system}`}>🐢 0.5x — watch every detail</div>
          <div className={`${styles.bubble} ${styles.user}`}>&ldquo;Show me the ingredients&rdquo;</div>
          <div className={`${styles.bubble} ${styles.system}`}>📋 Ingredients panel open</div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.logo}>
          COOK WITH <span>JOE</span>
        </div>
        <p>
          Concept mockup — not connected to live data. Dark, content-forward, Netflix-inspired
          browsing for recipe video.
        </p>
      </footer>
    </div>
  );
}
