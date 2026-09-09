import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only the app and the ingest API are behind Clerk. The API routes check their own bearer key and must not be redirected to sign-in, so they are matched but not protected.
const isApp = createRouteMatcher(["/app(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isApp(req)) await auth.protect();
});

export const config = { matcher: ["/app(.*)", "/api/v1/(.*)"] };
