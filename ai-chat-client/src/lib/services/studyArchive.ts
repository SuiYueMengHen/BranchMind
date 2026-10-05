import { getDB } from "@/lib/db/indexedDB";
import { transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
export const ARCHIVE_STORES = Object.keys(DB_CONFIG.stores) as Array<keyof typeof DB_CONFIG.stores>;
export interface StudyArchive {
  format: "branchmind";
  version: 1;
  exportedAt: number;
  stores: Record<string, Record<string, unknown>[]>;
}
export function validateArchive(value: unknown): asserts value is StudyArchive {
  if (!value || typeof value !== "object") throw new Error("不是有效的 Branch Mind 备份");
  const a = value as StudyArchive;
  if (a.format !== "branchmind" || a.version !== 1 || !a.stores || !Number.isFinite(a.exportedAt))
    throw new Error("不支持的备份格式或版本");
  for (const name of ARCHIVE_STORES) {
    if (!Array.isArray(a.stores[name])) throw new Error(`备份缺少 ${name}`);
    const keyPath = DB_CONFIG.stores[name].keyPath;
    const seen = new Set<string>();
    for (const row of a.stores[name]) {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row[keyPath] !== "string" ||
        !row[keyPath] ||
        seen.has(row[keyPath] as string)
      )
        throw new Error(`备份中的 ${name} 记录无效或重复`);
      seen.add(row[keyPath] as string);
    }
  }
  const nodes = new Set(a.stores.nodes.map((n) => n.id));
  for (const n of a.stores.nodes) {
    if (
      typeof n.content !== "string" ||
      !["system", "user", "assistant", "compressed"].includes(n.type as string) ||
      !n.metadata ||
      !Number.isFinite(n.createdAt) ||
      (n.parentId !== null && !nodes.has(n.parentId))
    )
      throw new Error("备份包含无效的对话节点");
  }
  const byId = new Map(a.stores.nodes.map((n) => [n.id, n]));
  const finished = new Set<unknown>();
  for (const n of a.stores.nodes) {
    const seen = new Set<unknown>();
    let id: unknown = n.id;
    while (id && !finished.has(id)) {
      if (seen.has(id)) throw new Error("备份存在循环分支");
      seen.add(id);
      id = byId.get(id)?.parentId;
    }
    for (const key of seen) finished.add(key);
  }
  for (const t of a.stores.trees) {
    if (!nodes.has(t.rootId) || typeof t.title !== "string") throw new Error("备份课程缺少根节点");
    if (t.learning) {
      const l = t.learning as import("@/types/learning").LearningState;
      if (
        !Array.isArray(l.branches) ||
        !Array.isArray(l.memories) ||
        typeof l.notation !== "string" ||
        !l.branches.some((b) => b.id === l.activeBranchId)
      )
        throw new Error("学习结构无效");
      if (
        l.profile !== undefined &&
        (!l.profile ||
          typeof l.profile.learningGoal !== "string" ||
          typeof l.profile.priorKnowledge !== "string" ||
          !l.profile.learningGoal.trim() ||
          !l.profile.priorKnowledge.trim() ||
          l.profile.learningGoal.length > 4000 ||
          l.profile.priorKnowledge.length > 4000)
      )
        throw new Error("课程学习目标或已有基础无效");
      const branchIds = new Set(l.branches.map((b) => b.id));
      if (branchIds.size !== l.branches.length) throw new Error("答疑分支重复");
      for (const b of l.branches) {
        if (
          !nodes.has(b.sourceNodeId) ||
          !nodes.has(b.tipNodeId) ||
          !b.notes ||
          !["rigorous", "intuitive", "concise", "custom"].includes(b.notes.style) ||
          typeof b.notes.customInstructions !== "string" ||
          typeof b.notes.bilingual !== "boolean" ||
          typeof b.title !== "string" ||
          !["main", "question", "lesson"].includes(b.kind) ||
          (b.parentBranchId !== null && !branchIds.has(b.parentBranchId))
        )
          throw new Error("答疑分支或讲义风格无效");
      }
      if (l.branches.filter((b) => b.kind === "main").length !== 1)
        throw new Error("课程主线数量无效");
      for (const branch of l.branches) {
        const seen = new Set<string>();
        let cursor: typeof branch | undefined = branch;
        while (cursor) {
          if (seen.has(cursor.id)) throw new Error("章节树包含循环关系");
          seen.add(cursor.id);
          cursor = l.branches.find((b) => b.id === cursor!.parentBranchId);
        }
        if (
          branch.kind === "lesson" &&
          (typeof branch.canExpand !== "boolean" ||
            typeof branch.description !== "string" ||
            !["unplanned", "ready", "leaf"].includes(branch.outlineStatus ?? ""))
        )
          throw new Error("章节规划状态无效");
      }
      for (const m of l.memories)
        if (typeof m.content !== "string" || !nodes.has(m.sourceNodeId))
          throw new Error("共享笔记无效");
    }
  }
  for (const c of a.stores.contextBoxes)
    if (!Array.isArray(c.blocks)) throw new Error("上下文记录无效");
}
export async function exportStudyArchive(): Promise<StudyArchive> {
  const db = await getDB();
  const tx = db.transaction(ARCHIVE_STORES, "readonly");
  const done = transactionToPromise(tx);
  const stores: StudyArchive["stores"] = {};
  await Promise.all(
    ARCHIVE_STORES.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const req = tx.objectStore(name).getAll();
          req.onsuccess = () => {
            stores[name] = req.result;
            resolve();
          };
          req.onerror = () => reject(req.error);
        }),
    ),
  );
  await done;
  return { format: "branchmind", version: 1, exportedAt: Date.now(), stores };
}
export async function importStudyArchive(archive: unknown): Promise<void> {
  validateArchive(archive);
  const db = await getDB();
  const tx = db.transaction(ARCHIVE_STORES, "readwrite");
  const done = transactionToPromise(tx);
  for (const name of ARCHIVE_STORES) {
    const store = tx.objectStore(name);
    store.clear();
    for (const row of archive.stores[name]) store.put(row);
  }
  await done;
}
export function downloadArchive(archive: StudyArchive) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `branch-mind-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
