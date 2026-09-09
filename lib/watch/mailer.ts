import { Resend } from "resend";
import type { Mailer } from "./alert";

/** Resend, from RESEND_API_KEY. The sender is ALERT_FROM, Resend's onboarding sender until deadlatch.dev is verified there. */
export function resendMailer(): Mailer {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM ?? "Deadlatch <onboarding@resend.dev>";
  if (!key) return { async send() { /* no provider configured, the alert row is rolled back by the caller */ throw new Error("RESEND_API_KEY is not set"); } };
  const client = new Resend(key);
  return {
    async send({ to, subject, text }) {
      const r = await client.emails.send({ from, to, subject, text });
      if (r.error) throw new Error(r.error.message);
    },
  };
}
