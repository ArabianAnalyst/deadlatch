"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { acknowledge, createProject, projectFor, rotateKey, setQuiet } from "@/lib/watch/queries";

async function owner(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/app");
  return userId;
}

export interface KeyState { key: string | null; projectId: string | null; stream: string | null; error: string | null }

export async function createProjectAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const ownerId = await owner();
  try {
    const { project, key } = await createProject(db, ownerId, String(form.get("name") ?? ""), String(form.get("stream") ?? "purse"));
    revalidatePath("/app");
    return { key, projectId: project.id, stream: project.stream, error: null };
  } catch (e) {
    return { key: null, projectId: null, stream: null, error: (e as Error).message };
  }
}

export async function rotateKeyAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const ownerId = await owner();
  const projectId = String(form.get("projectId") ?? "");
  const project = await projectFor(db, ownerId, projectId);
  if (!project) return { key: null, projectId: null, stream: null, error: "not your project" };
  const { key } = await rotateKey(db, ownerId, projectId);
  revalidatePath(`/app/${projectId}/settings`);
  return { key, projectId, stream: project.stream, error: null };
}

export async function acknowledgeAction(form: FormData): Promise<void> {
  const ownerId = await owner();
  const projectId = String(form.get("projectId") ?? "");
  const flagId = String(form.get("flagId") ?? "");
  await acknowledge(db, ownerId, projectId, flagId);
  revalidatePath(`/app/${projectId}/flags/${flagId}`);
  revalidatePath(`/app/${projectId}`);
}

export async function setQuietAction(form: FormData): Promise<void> {
  const ownerId = await owner();
  const projectId = String(form.get("projectId") ?? "");
  const hours = Number(form.get("hours") ?? 6);
  const clamped = Math.min(720, Math.max(1 / 60, Number.isFinite(hours) ? hours : 6));
  try {
    await setQuiet(db, ownerId, projectId, Math.round(clamped * 3_600_000));
  } catch (e) {
    console.error("setQuiet refused", { projectId, error: e instanceof Error ? e.message : String(e) });
  }
  revalidatePath(`/app/${projectId}/settings`);
}
