import type { Metadata } from "next";
import AuditForm from "@/components/AuditForm";

export const metadata: Metadata = {
  title: "Agent Payment Security Audit — Deadlatch",
  description: "Can a compromised agent move money outside policy? Nine questions, eight dimensions, blast radius in your own numbers. Runs in your browser, nothing leaves the page.",
  alternates: { canonical: "https://deadlatch.dev/audit" },
};

export default function AuditPage() {
  return (
    <main className="wrap logwrap">
      <header className="log-hd">
        <div className="eyebrow">Agent Payment Security Audit</div>
        <h1>Can a compromised agent move money outside policy?</h1>
        <p>Nine questions about your agent&apos;s payment setup, scored on eight dimensions. Anything you leave out comes back as Unknown with the exact question to ask. The blast radius is in your own numbers. This is a diagnostic, not a sales tool.</p>
        <p className="mono af-cli">npx @olurabian/audit</p>
      </header>
      <AuditForm />
    </main>
  );
}
