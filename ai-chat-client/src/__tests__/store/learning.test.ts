import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "@/lib/db/indexedDB";
import { createAppStore } from "@/store/useStore";
import type { ChatParams } from "@/lib/services/llmService";
import { getLearningState } from "@/lib/services/learningService";
import {
  exportStudyArchive,
  importStudyArchive,
  validateArchive,
} from "@/lib/services/studyArchive";

beforeEach(async () => {
  await deleteDB();
});
async function setup() {
  const chat = vi.fn(async (p: ChatParams) => `讲义：${String(p.messages.at(-1)?.content)}`);
  const store = createAppStore({ llmService: { chat } });
  await store.getState().initialize();
  store.setState({
    longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
  });
  await store.getState().updateTreeTitle(store.getState().currentTreeId!, "量子力学");
  return { store, chat };
}
describe("Branch Mind learning continuity", () => {
  it("keeps Q&A off the main path, returns to its saved tip, and restores branch state", async () => {
    const { store, chat } = await setup();
    const main = await store.getState().sendMessage("讲解态矢量");
    await store.getState().createQuestionBranch(main.id, "为什么归一化？");
    const questionBranch = store.getState().getCurrentTree()!.learning!.activeBranchId;
    const answer = await store.getState().sendMessage("归一化的物理意义？");
    const questionCall = chat.mock.calls.at(-1)![0];
    expect(JSON.stringify(questionCall.messages)).toContain("讲解态矢量");
    await store.getState().selectStudyBranch("main");
    expect(store.getState().activeNodeId).toBe(main.id);
    await store.getState().sendMessage("继续讲算符");
    const mainCall = chat.mock.calls.at(-1)![0];
    expect(JSON.stringify(mainCall.messages)).not.toContain("归一化的物理意义？");
    await store.getState().selectStudyBranch(questionBranch);
    expect(store.getState().activeNodeId).toBe(answer.id);
    const restored = createAppStore();
    await restored.getState().initialize();
    expect(restored.getState().activeNodeId).toBe(answer.id);
    expect(
      restored
        .getState()
        .getCurrentTree()!
        .learning!.branches.find((b) => b.id === "main")!.tipNodeId,
    ).not.toBe(answer.id);
  });
  it("supports nested questions without advancing the parent question", async () => {
    const { store } = await setup();
    const main = await store.getState().sendMessage("开始学习");
    await store.getState().createQuestionBranch(main.id, "问题一");
    const parent = store.getState().getCurrentTree()!.learning!.activeBranchId;
    const first = await store.getState().sendMessage("问题一的内容");
    await store.getState().createQuestionBranch(first.id, "问题二");
    const nested = store.getState().getCurrentTree()!.learning!.branches.at(-1)!;
    expect(nested.parentBranchId).toBe(parent);
    await store.getState().sendMessage("追问内容");
    await store.getState().selectStudyBranch(parent);
    expect(store.getState().activeNodeId).toBe(first.id);
  });
  it("injects notation and confirmed shared notes on both branches and stores per-lecture styles", async () => {
    const { store, chat } = await setup();
    let l = getLearningState(store.getState().getCurrentTree()!, store.getState().nodes);
    l = {
      ...l,
      notation: "ℏ 是约化普朗克常数",
      branches: l.branches.map((b) => ({
        ...b,
        notes: { style: "rigorous", bilingual: true, customInstructions: "定义编号" },
      })),
    };
    await store.getState().saveLearning(l);
    store
      .getState()
      .setNextNotePreferences({
        style: "intuitive",
        bilingual: false,
        customInstructions: "先举例",
      });
    const main = await store.getState().sendMessage("讲解态矢量");
    expect(main.metadata.notePreferences?.style).toBe("intuitive");
    expect(JSON.stringify(chat.mock.calls.at(-1)![0].messages)).toContain("ℏ 是约化普朗克常数");
    await store.getState().shareStudyMemory(main.id, "学生已理解态矢量，尚未验证练习");
    await store.getState().createQuestionBranch(main.id, "归一化");
    const answer = await store.getState().sendMessage("请解释");
    const prompt = JSON.stringify(chat.mock.calls.at(-1)![0].messages);
    expect(prompt).toContain("学生已理解态矢量");
    expect(prompt).toContain("首次出现");
    expect(prompt).toContain("定义编号");
    expect(answer.metadata.notePreferences?.style).toBe("rigorous");
    expect(store.getState().nextNotePreferences).toBeNull();
  });
  it("preserves the main tip on model errors and retains the failed question for retry", async () => {
    const { store, chat } = await setup();
    const main = await store.getState().sendMessage("开始");
    await store.getState().createQuestionBranch(main.id, "问题");
    chat.mockRejectedValueOnce(new Error("模型暂不可用"));
    await expect(store.getState().sendMessage("失败的问题")).rejects.toThrow();
    const failed = store.getState().activeNodeId;
    await store.getState().selectStudyBranch("main");
    expect(store.getState().activeNodeId).toBe(main.id);
    const branch = store
      .getState()
      .getCurrentTree()!
      .learning!.branches.find((b) => b.kind === "question")!;
    await store.getState().selectStudyBranch(branch.id);
    expect(store.getState().activeNodeId).toBe(failed);
  });
  it("round-trips branches and memories atomically and rejects broken snapshots without deleting local data", async () => {
    const { store } = await setup();
    const main = await store.getState().sendMessage("开始");
    await store.getState().createQuestionBranch(main.id, "答疑");
    await store.getState().shareStudyMemory(main.id, "保留的结论");
    const archive = await exportStudyArchive();
    validateArchive(archive);
    const bad = structuredClone(archive);
    bad.stores.nodes = [];
    await expect(importStudyArchive(bad)).rejects.toThrow();
    expect((await exportStudyArchive()).stores.nodes.length).toBe(archive.stores.nodes.length);
    await deleteDB();
    await importStudyArchive(archive);
    const restored = createAppStore();
    await restored.getState().initialize();
    expect(restored.getState().getCurrentTree()!.learning!.memories[0].content).toBe("保留的结论");
    expect(restored.getState().getCurrentTree()!.learning!.branches).toHaveLength(2);
  });
});
