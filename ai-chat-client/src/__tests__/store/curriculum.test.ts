import { beforeEach, expect, it, vi } from "vitest";
import { deleteDB } from "@/lib/db/indexedDB";
import { createAppStore } from "@/store/useStore";
import type { ChatParams } from "@/lib/services/llmService";
import { parseCourseOutline, courseContinuityPrompt } from "@/lib/services/curriculumService";
import { exportStudyArchive, validateArchive } from "@/lib/services/studyArchive";

beforeEach(async () => {
  await deleteDB();
});
const chapters = {
  summary: "依次学习态、算符",
  notation: "ℏ 表示约化普朗克常数；态矢量用 |ψ⟩；内积对第二个变量线性。",
  children: [
    { title: "量子态", description: "掌握态矢量与空间", canExpand: true },
    { title: "测量概率", description: "使用 Born 规则计算概率", canExpand: false },
  ],
};
async function setup() {
  const chat = vi.fn(async (p: ChatParams) =>
    p.responseFormat ? JSON.stringify(chapters) : "# 定义\nℏ 表示约化普朗克常数，态矢量用 |ψ⟩。",
  );
  const store = createAppStore({ llmService: { chat } });
  await store.getState().initialize();
  await store.getState().updateTreeTitle(store.getState().currentTreeId!, "量子力学");
  store.setState({
    longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
  });
  return { store, chat };
}
it("atomically creates ordered chapters, keeps the main path, avoids duplicate generation, and restores the map", async () => {
  const { store, chat } = await setup();
  await store.getState().generateStudyOutline("量子力学需要分为哪些章节？");
  const learning = store.getState().getCurrentTree()!.learning!;
  expect(learning.activeBranchId).toBe("main");
  expect(learning.branches.filter((b) => b.kind === "lesson").map((b) => b.title)).toEqual([
    "量子态",
    "测量概率",
  ]);
  expect(learning.notation).toContain("ℏ");
  expect(store.getState().nodes.has(learning.branches[1].id)).toBe(true);
  const calls = chat.mock.calls.length;
  await store.getState().generateStudyOutline();
  expect(chat.mock.calls).toHaveLength(calls);
  const restored = createAppStore();
  await restored.getState().initialize();
  expect(restored.getState().getCurrentTree()!.learning).toEqual(learning);
  validateArchive(await exportStudyArchive());
});
it("creates nested sections, starts a leaf, and shares notation and earlier lectures without raw Q&A", async () => {
  const { store, chat } = await setup();
  await store.getState().generateStudyOutline();
  let learning = store.getState().getCurrentTree()!.learning!;
  const chapter = learning.branches[1];
  await store.getState().selectStudyBranch(chapter.id);
  chat.mockResolvedValueOnce(
    JSON.stringify({
      summary: "具体小节",
      notation: "不能覆盖现有约定",
      children: [{ title: "态矢量归一化", description: "理解单位范数", canExpand: false }],
    }),
  );
  await store.getState().generateStudyOutline();
  learning = store.getState().getCurrentTree()!.learning!;
  const leaf = learning.branches.at(-1)!;
  expect(leaf.parentBranchId).toBe(chapter.id);
  expect(leaf.canExpand).toBe(false);
  expect(learning.notation).toContain("ℏ");
  await store.getState().selectStudyBranch(leaf.id);
  const count = chat.mock.calls.length;
  await store.getState().generateStudyOutline();
  expect(chat.mock.calls).toHaveLength(count);
  await store.getState().startStudyLesson();
  expect(store.getState().getCurrentTree()!.learning!.branches.at(-1)!.started).toBe(true);
  const firstLecture = store.getState().getActiveNode()!;
  await store.getState().createQuestionBranch(firstLecture.id, "只属于答疑的问题");
  await store.getState().sendMessage("答疑独有的用户问题 XYZ");
  const other = learning.branches.find((b) => b.title === "测量概率")!;
  await store.getState().selectStudyBranch(other.id);
  await store.getState().startStudyLesson();
  const messages = JSON.stringify(chat.mock.calls.at(-1)![0].messages);
  expect(messages).toContain("章节「态矢量归一化」已生成讲义");
  expect(messages).toContain("内积对第二个变量线性");
  expect(messages).not.toContain("答疑独有的用户问题 XYZ");
  expect(
    store
      .getState()
      .getCurrentTree()!
      .learning!.branches.find((b) => b.id === leaf.id)!.tipNodeId,
  ).toBe(firstLecture.id);
});
it("keeps data unchanged after invalid output and allows retry", async () => {
  const { store, chat } = await setup();
  const before = store.getState().nodes.size;
  chat.mockResolvedValueOnce("invalid json");
  await expect(store.getState().generateStudyOutline()).rejects.toThrow("JSON");
  expect(store.getState().nodes.size).toBe(before);
  expect(store.getState().isPlanning).toBe(false);
  expect(store.getState().getCurrentTree()!.learning).toBeUndefined();
  await store.getState().generateStudyOutline();
  expect(store.getState().getCurrentTree()!.learning!.branches).toHaveLength(3);
});
it("marks an already specific topic as a leaf when the model returns no children", async () => {
  const { store, chat } = await setup();
  await store.getState().generateStudyOutline();
  const parent = store.getState().getCurrentTree()!.learning!.branches[1];
  await store.getState().selectStudyBranch(parent.id);
  chat.mockResolvedValueOnce(
    JSON.stringify({ summary: "无需继续细分", notation: "", children: [] }),
  );
  await store.getState().generateStudyOutline();
  expect(
    store
      .getState()
      .getCurrentTree()!
      .learning!.branches.find((b) => b.id === parent.id)!.outlineStatus,
  ).toBe("leaf");
});
it("rejects invalid or duplicate chapters and excludes Q&A from automatic course references", () => {
  expect(() =>
    parseCourseOutline(
      JSON.stringify({ ...chapters, children: [chapters.children[0], chapters.children[0]] }),
    ),
  ).toThrow("重复");
  expect(() =>
    parseCourseOutline(JSON.stringify({ ...chapters, children: [{ title: "无标记" }] })),
  ).toThrow();
  const main = {
    id: "main",
    title: "主线",
    kind: "main" as const,
    parentBranchId: null,
    sourceNodeId: "r",
    tipNodeId: "r",
    notes: { style: "rigorous" as const, bilingual: true, customInstructions: "" },
    resolved: false,
  };
  const learning = { activeBranchId: "main", branches: [main], notation: "", memories: [] };
  expect(courseContinuityPrompt(learning, main, new Map())).toContain("共享符号约定");
});

it("requires an explicit topic before planning and reuses the initial blank workspace", async () => {
  const chat = vi.fn(async () => JSON.stringify(chapters));
  const store = createAppStore({ llmService: { chat } });
  await store.getState().initialize();
  const initialId = store.getState().currentTreeId;
  await expect(store.getState().createStudyCourse("   ")).rejects.toThrow("输入学习主题");
  await expect(store.getState().generateStudyOutline()).rejects.toThrow("输入学习主题");
  expect(chat).not.toHaveBeenCalled();
  await store.getState().createStudyCourse("  量子力学  ");
  expect(store.getState().currentTreeId).toBe(initialId);
  expect(store.getState().trees.size).toBe(1);
  expect(store.getState().getCurrentTree()!.title).toBe("量子力学");
  expect(chat).toHaveBeenCalledTimes(1);
  expect(
    store
      .getState()
      .getCurrentTree()!
      .learning!.branches.filter((b) => b.kind === "lesson"),
  ).toHaveLength(2);
});
it("routes free input to independent Q&A, even when the question mentions creating chapters", async () => {
  const { store, chat } = await setup();
  const send = vi.fn(async () => store.getState().getActiveNode()!);
  store.setState({ sendMessage: send });
  await store.getState().generateStudyOutline();
  const original = store.getState().getCurrentTree()!.learning!;
  const mainTip = original.branches[0].tipNodeId;
  chat.mockClear();
  await store.getState().sendStudyQuestion("为什么要创建这些章节？");
  const updated = store.getState().getCurrentTree()!.learning!;
  const question = updated.branches.at(-1)!;
  expect(question.kind).toBe("question");
  expect(question.parentBranchId).toBe("main");
  expect(updated.branches[0].tipNodeId).toBe(mainTip);
  expect(updated.activeBranchId).toBe(question.id);
  expect(send).toHaveBeenCalledWith("为什么要创建这些章节？");
  expect(chat).not.toHaveBeenCalled();
  await store.getState().sendStudyQuestion("继续追问");
  expect(store.getState().getCurrentTree()!.learning!.branches).toHaveLength(
    updated.branches.length,
  );
  await store.getState().selectStudyBranch(original.branches[1].id);
  await store.getState().sendStudyQuestion("这一章中的态是什么意思？");
  expect(store.getState().getCurrentTree()!.learning!.branches.at(-1)!.parentBranchId).toBe(
    original.branches[1].id,
  );
});
it("retries a failed initial plan without creating another course", async () => {
  const { store, chat } = await setup();
  chat.mockRejectedValueOnce(new Error("模型暂时不可用"));
  await expect(store.getState().createStudyCourse("电动力学")).rejects.toThrow("模型暂时不可用");
  const id = store.getState().currentTreeId;
  const count = store.getState().trees.size;
  await store.getState().createStudyCourse("电动力学");
  expect(store.getState().currentTreeId).toBe(id);
  expect(store.getState().trees.size).toBe(count);
});
