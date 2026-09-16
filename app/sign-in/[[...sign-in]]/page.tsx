import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign in · Deadlatch",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <main className="signin-wrap">
      <SignIn
        appearance={{
          variables: {
            colorBackground: "var(--panel)",
            colorInput: "var(--ground)",
            colorForeground: "var(--ink)",
            colorMutedForeground: "var(--muted)",
            colorPrimary: "var(--allow)",
            colorInputForeground: "var(--ink)",
            borderRadius: "9px",
          },
        }}
      />
    </main>
  );
}
