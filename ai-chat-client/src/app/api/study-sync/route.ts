import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { validateArchive, type StudyArchive } from "@/lib/services/studyArchive";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 20 * 1024 * 1024;
interface Snapshot {
  revision: number;
  archive: StudyArchive;
}
function authorize(req: NextRequest) {
  const token = process.env.BRANCH_MIND_SYNC_TOKEN;
  if (!token || token.length < 24)
    return NextResponse.json(
      { error: "同步尚未启用：服务器需配置至少 24 位的 BRANCH_MIND_SYNC_TOKEN" },
      { status: 503 },
    );
  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer /, "") ??
    req.cookies.get("branchmind-session")?.value ??
    "";
  const a = Buffer.from(token),
    b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return NextResponse.json({ error: "同步口令不正确" }, { status: 401 });
  return null;
}
function directory() {
  return process.env.BRANCH_MIND_DATA_DIR || path.join(process.cwd(), ".branchmind");
}
async function readSnapshot(): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(path.join(directory(), "study.json"), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function GET(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;
  try {
    const snapshot = await readSnapshot();
    return NextResponse.json(snapshot ?? { revision: 0, archive: null }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "读取同步数据失败" }, { status: 500 });
  }
}
export async function PUT(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;
  if (Number(req.headers.get("content-length")) > MAX_BYTES)
    return NextResponse.json({ error: "备份超过 20MB" }, { status: 413 });
  let body: { baseRevision: number; archive: StudyArchive };
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (!req.body) throw new Error("请求缺少数据");
    const reader = req.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "备份超过 20MB" }, { status: 413 });
      }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!Number.isInteger(body.baseRevision) || body.baseRevision < 0)
      throw new Error("同步版本无效");
    validateArchive(body.archive);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "备份无效" },
      { status: 400 },
    );
  }
  const dir = directory();
  const lock = path.join(dir, "sync.lock");
  try {
    await mkdir(dir, { recursive: true });
    await mkdir(lock);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          (e as NodeJS.ErrnoException).code === "EEXIST"
            ? "另一台设备正在同步，请稍后重试"
            : "无法访问同步目录",
      },
      { status: 503 },
    );
  }
  try {
    const current = await readSnapshot();
    const revision = current?.revision ?? 0;
    if (body.baseRevision !== revision)
      return NextResponse.json(
        { error: "其他设备已更新数据。请先备份本机，再下载最新版本；不会覆盖云端内容。", revision },
        { status: 409 },
      );
    const next = { revision: revision + 1, archive: body.archive };
    const temp = path.join(dir, `study-${crypto.randomUUID()}.tmp`);
    try {
      await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
      await rename(temp, path.join(dir, "study.json"));
    } finally {
      await rm(temp, { force: true });
    }
    return NextResponse.json(
      { revision: next.revision },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "保存同步数据失败" }, { status: 500 });
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
