import type { NextRequest } from "next/server";
/** NextURL can normalize loopback hosts; preserve the actual HTTP Host header. */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const configured = process.env.BRANCH_MIND_PUBLIC_ORIGIN;
    if (configured) return new URL(origin).origin === new URL(configured).origin;
    const host = req.headers.get("host") ?? req.nextUrl.host;
    const protocol =
      req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
      req.nextUrl.protocol.replace(":", "");
    const parsed = new URL(origin);
    return parsed.host === host && parsed.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
