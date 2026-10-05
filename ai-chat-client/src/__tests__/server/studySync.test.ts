import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/study-sync/route";
import { exportStudyArchive } from "@/lib/services/studyArchive";
import { deleteDB } from "@/lib/db/indexedDB";
const secret = "branch-mind-test-token-0123456789";
let dir: string;
const oldToken = process.env.BRANCH_MIND_SYNC_TOKEN,
  oldDir = process.env.BRANCH_MIND_DATA_DIR;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "branchmind-sync-test-"));
  process.env.BRANCH_MIND_DATA_DIR = dir;
  process.env.BRANCH_MIND_SYNC_TOKEN = secret;
  await deleteDB();
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  if (oldToken === undefined) delete process.env.BRANCH_MIND_SYNC_TOKEN;
  else process.env.BRANCH_MIND_SYNC_TOKEN = oldToken;
  if (oldDir === undefined) delete process.env.BRANCH_MIND_DATA_DIR;
  else process.env.BRANCH_MIND_DATA_DIR = oldDir;
});
function req(method = "GET", body?: unknown, token = secret) {
  return new NextRequest("http://localhost/api/study-sync", {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
describe("study sync", () => {
  it("requires configured credentials", async () => {
    expect((await GET(req("GET", undefined, "wrong"))).status).toBe(401);
    delete process.env.BRANCH_MIND_SYNC_TOKEN;
    expect((await GET(req())).status).toBe(503);
  });
  it("rejects stale revisions and leaves the latest archive intact", async () => {
    const archive = await exportStudyArchive();
    expect((await PUT(req("PUT", { baseRevision: 0, archive }))).status).toBe(200);
    expect((await PUT(req("PUT", { baseRevision: 0, archive }))).status).toBe(409);
    const snapshot = await (await GET(req())).json();
    expect(snapshot.revision).toBe(1);
    expect(snapshot.archive.format).toBe("branchmind");
  });
  it("rejects invalid archives and permits only one concurrent writer", async () => {
    expect((await PUT(req("PUT", { baseRevision: 0, archive: {} }))).status).toBe(400);
    const archive = await exportStudyArchive();
    const results = await Promise.all([
      PUT(req("PUT", { baseRevision: 0, archive })),
      PUT(req("PUT", { baseRevision: 0, archive })),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await (await GET(req())).json()).revision).toBe(1);
  });
});
