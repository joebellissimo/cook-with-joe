import { Jost } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
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
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full antialiased ${jost.variable}`}>
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <SiteHeader />
        <main className="flex-1 w-full">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
