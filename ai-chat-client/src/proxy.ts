import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/server/requestOrigin";
import { timingSafeEqual } from "node:crypto";
export function proxy(req: NextRequest) {
  const token = process.env.BRANCH_MIND_SYNC_TOKEN;
  if (!token) return NextResponse.next();
  const pathname = req.nextUrl.pathname;
  if (
    pathname === "/connect" ||
    pathname === "/api/study-session" ||
    pathname === "/api/status" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icon") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico"
  )
    return NextResponse.next();
  const supplied =
    req.cookies.get("branchmind-session")?.value ??
    req.headers.get("authorization")?.replace(/^Bearer /, "") ??
    "";
  const a = Buffer.from(token),
    b = Buffer.from(supplied);
  if (token.length >= 24 && a.length === b.length && timingSafeEqual(a, b)) {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !isSameOrigin(req))
      return NextResponse.json({ error: "请求来源不匹配" }, { status: 403 });
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/"))
    return NextResponse.json({ error: "请先连接学习空间" }, { status: 401 });
  return NextResponse.redirect(new URL("/connect", req.url));
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
