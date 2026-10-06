import { NextResponse } from "next/server";
import packageInfo from "../../../../package.json";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { app: "Branch Mind", version: packageInfo.version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
