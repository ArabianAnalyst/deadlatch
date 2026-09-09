"use client";
import { useActionState } from "react";
import { createProjectAction, type KeyState } from "@/app/app/actions";
import { configLines } from "@/lib/watch/config-lines";

const initial: KeyState = { key: null, projectId: null, error: null };

export default function CreateProject({ origin }: { origin: string }) {
  const [state, action, pending] = useActionState(createProjectAction, initial);
  if (state.key && state.projectId) {
    return (
      <div className="app-card app-key">
        <div className="eyebrow">Your project key, shown once</div>
        <p>Copy these three lines into the broker's environment. The key is not stored anywhere in plain text and cannot be shown again. Rotate it from settings if you lose it.</p>
        <pre className="mono">{configLines(state.key, "purse", origin)}</pre>
        <a className="btn primary" href={`/app/${state.projectId}`}>Open the project</a>
      </div>
    );
  }
  return (
    <form action={action} className="app-card app-form">
      <label>Name<input name="name" required maxLength={80} placeholder="reference broker" /></label>
      <label>Stream<input name="stream" defaultValue="purse" maxLength={80} /></label>
      {state.error ? <p className="app-error">{state.error}</p> : null}
      <button className="btn primary" disabled={pending} type="submit">{pending ? "Creating" : "Create project"}</button>
    </form>
  );
}
