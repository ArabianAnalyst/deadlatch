import type { Metadata } from "next";
import Playground from "@/components/try/Playground";

export const metadata: Metadata = {
  title: "Try it — Deadlatch",
  description: "Route a spend through a real broker, watch it decide, see the chained receipt and its anchored head, and trip a flag. Mock rail, nothing settles. Thirty seconds, no sign-up.",
};
export const dynamic = "force-dynamic";

export default function TryPage() {
  const brokerUrl = process.env.TRY_BROKER_URL ?? "";
  const witnessUrl = process.env.TRY_WITNESS_URL ?? "";
  const configured = Boolean(brokerUrl && witnessUrl && process.env.TRY_PROJECT_ID && process.env.TRY_LOG_KEY);
  return (
    <main className="wrap logwrap app try">
      <header className="log-hd">
        <div className="eyebrow">The playground</div>
        <h1>Press a button. A real broker decides.</h1>
        <p className="try-strip mono">
          A playground broker. Mock rail, nothing settles. Same image as the reference deployment, its own chain. Every button is a real call, and the curl that does the same thing sits beside the result.
        </p>
      </header>
      {configured ? <Playground brokerUrl={brokerUrl} witnessUrl={witnessUrl} /> : <p className="app-error">The playground is not configured on this deployment.</p>}
    </main>
  );
}
