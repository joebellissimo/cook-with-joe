"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();
  // The recipe player builds its own full-viewport mobile layout (video +
  // scrollable steps + a control bar pinned to the bottom of the screen).
  // The site header's height pushes that control bar below the visible
  // viewport on phones, so it's hidden there specifically — still shown at
  // md and up, and on every other page at every size.
  const isRecipePage = pathname?.startsWith("/recipe/");

  return (
    <header
      className={`sticky top-0 z-30 border-b border-ink/10 bg-cream/95 backdrop-blur ${
        isRecipePage ? "hidden md:block" : ""
      }`}
    >
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-medium tracking-tight text-ink"
        >
          <span aria-hidden="true">🍳</span>
          Cook With Joe
        </Link>
        <nav className="eyebrow flex items-center gap-6 text-[11px]">
          <Link href="/" className="hover:text-ink transition-colors">
            Recipes
          </Link>
          <Link href="/admin/upload" className="hover:text-ink transition-colors">
            Upload
          </Link>
          <Link href="/pricing" className="hover:text-ink transition-colors">
            Pricing
          </Link>
        </nav>
      </div>
    </header>
  );
}
