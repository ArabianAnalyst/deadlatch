import { ClerkProvider, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <div className="wrap app-bar">
        <Link href="/app" className="mono app-muted">deadlatch watch</Link>
        <UserButton />
      </div>
      {children}
    </ClerkProvider>
  );
}
