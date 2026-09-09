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

export interface KeyState { key: string | null; projectId: string | null; error: string | null }

export async function createProjectAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const ownerId = await owner();
  try {
    const { project, key } = await createProject(db, ownerId, String(form.get("name") ?? ""), String(form.get("stream") ?? "purse"));
    revalidatePath("/app");
    return { key, projectId: project.id, error: null };
  } catch (e) {
    return { key: null, projectId: null, error: (e as Error).message };
  }
}

export async function rotateKeyAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const ownerId = await owner();
  const projectId = String(form.get("projectId") ?? "");
  if (!(await projectFor(db, ownerId, projectId))) return { key: null, projectId: null, error: "not your project" };
  const { key } = await rotateKey(db, projectId);
  revalidatePath(`/app/${projectId}/settings`);
  return { key, projectId, error: null };
}

export async function acknowledgeAction(form: FormData): Promise<void> {
  const ownerId = await owner();
  const projectId = String(form.get("projectId") ?? "");
  const flagId = String(form.get("flagId") ?? "");
  if (!(await projectFor(db, ownerId, projectId))) return;
  await acknowledge(db, projectId, flagId);
  revalidatePath(`/app/${projectId}/flags/${flagId}`);
  revalidatePath(`/app/${projectId}`);
}

export async function setQuietAction(form: FormData): Promise<void> {
  const ownerId = await owner();
  const projectId = String(form.get("projectId") ?? "");
  if (!(await projectFor(db, ownerId, projectId))) return;
  const hours = Number(form.get("hours") ?? 6);
  await setQuiet(db, projectId, Math.round(hours * 3_600_000));
  revalidatePath(`/app/${projectId}/settings`);
}
