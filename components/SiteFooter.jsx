"use client";

import { usePathname } from "next/navigation";

// Only populated when "Automatically expose System Environment Variables"
// is turned on for this Vercel project (Project Settings → Environment
// Variables) — until then these are undefined in every environment, not
// just local dev. Next.js inlines process.env.NEXT_PUBLIC_* at build time,
// so these are safe to reference in this client component as-is.
const COMMIT_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
const COMMIT_REF = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
const VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV;

const ENV_LABELS = {
  production: "Production",
  preview: "Preview",
  development: "Development",
};

export default function SiteFooter() {
  const pathname = usePathname();
  // Same reasoning as SiteHeader: the recipe player is a full-viewport
  // (h-dvh) mobile layout, and the footer's height below it forces a small
  // scroll to reveal it — hidden there specifically, below md, and also
  // in phone landscape past md's width threshold (see SiteHeader.jsx for
  // the full explanation).
  const isRecipePage = pathname?.startsWith("/recipe/");

  return (
    <footer
      className={`border-t border-ink/10 bg-white ${
        isRecipePage ? "hidden landscape:max-[950px]:hidden! md:block" : ""
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between sm:gap-3">
        <span>Cook With Joe — prototype build.</span>
        <span className="text-[10px] text-muted/70">
          {COMMIT_SHA ? (
            <>
              <a
                href={`https://github.com/joebellissimo/cook-with-joe/commit/${COMMIT_SHA}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-muted hover:underline"
              >
                {COMMIT_SHA.slice(0, 7)}
              </a>
              {COMMIT_REF ? ` (${COMMIT_REF})` : ""} ·{" "}
              {ENV_LABELS[VERCEL_ENV] || VERCEL_ENV || "unknown"}
            </>
          ) : (
            "local-dev"
          )}
        </span>
      </div>
    </footer>
  );
}
