import type { Metadata } from "next";
import localFont from "next/font/local";
import AuditForm from "@/components/AuditForm";

/**
 * The italic display face for the hero's `outside policy`. Declared page-locally, the same
 * way the homepage does it, so the 22 KiB file loads on `/` and `/audit` and on no other route.
 * Without it the browser slants the regular cut into a faux italic.
 */
const InstrumentSerifItalic = localFont({
  src: [{ path: "../fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" }],
  variable: "--font-serif-italic",
  display: "optional",
  preload: true,
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "Agent Payment Security Audit · Deadlatch",
  description: "Can a compromised agent move money outside policy? Nine questions, eight dimensions, blast radius in your own numbers. Runs in your browser, nothing leaves the page.",
  alternates: { canonical: "https://www.deadlatch.dev/audit" },
};

export default function AuditPage() {
  return (
    <main className={`wrap logwrap wide ${InstrumentSerifItalic.variable}`}>
      <header className="log-hd af-hero">
        <div className="eyebrow">Agent payment security audit</div>
        <h1>Can a compromised agent move money <em>outside policy</em>?</h1>
        <p>Nine questions about how your agent pays. The verdict builds as you answer, across eight dimensions. Leave anything you do not know, it comes back as the exact question to ask your team.</p>
        <div className="af-trust"><span className="af-dot" aria-hidden="true" />Runs entirely in your browser. Nothing you type is sent anywhere.</div>
      </header>
      <AuditForm>
        <span className="af-cli">or run it locally with npx @olurabian/audit</span>
      </AuditForm>
    </main>
  );
}
