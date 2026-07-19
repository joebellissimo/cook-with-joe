import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Cook With Joe",
  description:
    "Step-by-step cooking videos you can control by voice or by tapping the step you're on.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <header className="sticky top-0 z-30 bg-orange-600 text-white shadow-sm">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <span aria-hidden="true">🍳</span>
              Cook With Joe
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link href="/" className="hover:underline">
                Recipes
              </Link>
              <Link href="/admin/upload" className="hover:underline">
                Upload
              </Link>
              <Link href="/pricing" className="hover:underline">
                Pricing
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 w-full">{children}</main>
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-neutral-500">
            Cook With Joe — prototype build.
          </div>
        </footer>
      </body>
    </html>
  );
}
