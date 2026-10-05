import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/server/requestOrigin";
import { timingSafeEqual } from "node:crypto";
export async function POST(req: NextRequest) {
  const expected = process.env.BRANCH_MIND_SYNC_TOKEN;
  if (!expected || expected.length < 24)
    return NextResponse.json({ error: "服务器尚未配置有效的同步口令" }, { status: 503 });
  if (!isSameOrigin(req)) return NextResponse.json({ error: "请求来源不匹配" }, { status: 403 });
  if (Number(req.headers.get("content-length")) > 4096)
    return NextResponse.json({ error: "请求过大" }, { status: 413 });
  let supplied: string;
  try {
    const body = await req.json();
    supplied = typeof body.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ error: "请求无效" }, { status: 400 });
  }
  const a = Buffer.from(expected),
    b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return NextResponse.json({ error: "口令不正确" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("branchmind-session", expected, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
