import { acknowledgeAction } from "@/app/app/actions";

export default function Acknowledge({ projectId, flagId, acknowledgedAt }: { projectId: string; flagId: string; acknowledgedAt: Date | null }) {
  if (acknowledgedAt) return <p className="app-muted mono">acknowledged {acknowledgedAt.toISOString()}</p>;
  return (
    <form action={acknowledgeAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="flagId" value={flagId} />
      <button className="btn primary" type="submit">Acknowledge</button>
    </form>
  );
}
