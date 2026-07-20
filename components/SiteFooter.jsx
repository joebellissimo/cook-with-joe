"use client";

import { usePathname } from "next/navigation";

export default function SiteFooter() {
  const pathname = usePathname();
  // Same reasoning as SiteHeader: the recipe player is a full-viewport
  // (h-dvh) mobile layout, and the footer's height below it forces a small
  // scroll to reveal it — hidden there specifically, below md only.
  const isRecipePage = pathname?.startsWith("/recipe/");

  return (
    <footer
      className={`border-t border-ink/10 bg-white ${
        isRecipePage ? "hidden md:block" : ""
      }`}
    >
      <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted">
        Cook With Joe — prototype build.
      </div>
    </footer>
  );
}
