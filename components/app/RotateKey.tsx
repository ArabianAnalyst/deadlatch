"use client";
import { useActionState } from "react";
import { rotateKeyAction, type KeyState } from "@/app/app/actions";
import { configLines } from "@/lib/watch/config-lines";

const initial: KeyState = { key: null, projectId: null, stream: null, error: null };

export default function RotateKey({ projectId, stream, origin }: { projectId: string; stream: string; origin: string }) {
  const [state, action, pending] = useActionState(rotateKeyAction, initial);
  return (
    <div>
      {state.key ? (
        <div className="app-key">
          <div className="eyebrow">New key, shown once. The old one is revoked.</div>
          <pre className="mono">{configLines(state.key, stream, origin)}</pre>
        </div>
      ) : null}
      {state.error ? <p className="app-error">{state.error}</p> : null}
      <form action={action}>
        <input type="hidden" name="projectId" value={projectId} />
        <button className="btn" disabled={pending} type="submit">{pending ? "Rotating" : "Rotate key"}</button>
      </form>
    </div>
  );
}
