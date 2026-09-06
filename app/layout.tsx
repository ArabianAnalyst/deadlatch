import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.deadlatch.dev"),
  title: "Deadlatch — Runtime governance for AI agents",
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
    title: "Deadlatch — Runtime governance for AI agents",
    description:
      "Enforce what an agent can do, prove what it did, and watch for what slipped through. Open, composable, verifiable.",
    url: "https://www.deadlatch.dev",
    siteName: "Deadlatch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Deadlatch — Runtime governance for AI agents",
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
