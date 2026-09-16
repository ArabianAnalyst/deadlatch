import { ClerkProvider } from "@clerk/nextjs";

/** Clerk's client bundle is scoped to /sign-in and /app only. The homepage stays Clerk-free. */
export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
