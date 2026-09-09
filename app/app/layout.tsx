import { ClerkProvider } from "@clerk/nextjs";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
