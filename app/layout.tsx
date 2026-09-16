import type { Metadata } from "next";
import localFont from "next/font/local";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

// Local copies of geist's own font files, so we control preload: Sans is the headline
// font and preloads, Mono is off the critical path and does not.
const GeistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: true,
});
const GeistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.deadlatch.dev"),
  title: "Deadlatch · Runtime governance for AI agents",
  description:
    "The open runtime governance stack for AI agents. Enforce what an agent can do, prove what it did, and watch for what slipped through. Purse, blackbox, Tripwire. Open, composable, verifiable.",
  keywords: [
    "AI agents",
    "runtime governance",
    "agent security",
    "LLM",
    "agent payments",
    "audit log",
    "tamper-evident",
    "open source",
  ],
  authors: [{ name: "Oluwasegun Araba", url: "https://olurabian.com" }],
  openGraph: {
    title: "Deadlatch · Runtime governance for AI agents",
    description:
      "Enforce what an agent can do, prove what it did, and watch for what slipped through. Open, composable, verifiable.",
    url: "https://www.deadlatch.dev",
    siteName: "Deadlatch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Deadlatch · Runtime governance for AI agents",
    description:
      "The open runtime governance stack for AI agents. Enforce, prove, watch.",
    creator: "@Olurabian",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
