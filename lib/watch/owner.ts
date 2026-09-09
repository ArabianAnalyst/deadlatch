import { clerkClient } from "@clerk/nextjs/server";

/** The owner's primary email from Clerk, or null when the user or the address is missing. */
export async function ownerEmail(ownerId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(ownerId);
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
    return primary?.emailAddress ?? null;
  } catch {
    return null;
  }
}
