import Link from "next/link";
import { Jost } from "next/font/google";
import "./globals.css";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
});

export const metadata = {
  title: "Cook With Joe",
  description:
    "Step-by-step cooking videos you can control by voice or by tapping the step you're on.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full antialiased ${jost.variable}`}>
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <header className="sticky top-0 z-30 border-b border-ink/10 bg-cream/95 backdrop-blur">
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
        <main className="flex-1 w-full">{children}</main>
        <footer className="border-t border-ink/10 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted">
            Cook With Joe — prototype build.
          </div>
        </footer>
      </body>
    </html>
  );
}
