import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only the app is behind Clerk. The ingest API checks its own bearer key and never touches Clerk's middleware.
const isApp = createRouteMatcher(["/app(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isApp(req)) await auth.protect();
});

export const config = { matcher: ["/app(.*)"] };
