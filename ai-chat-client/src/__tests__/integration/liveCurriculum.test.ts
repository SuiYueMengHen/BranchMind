import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { createAppStore } from "@/store/useStore";
import { deleteDB } from "@/lib/db/indexedDB";
import { exportStudyArchive, validateArchive } from "@/lib/services/studyArchive";

// Explicit opt-in. Credentials live outside the repo and are never logged or stored in report artifacts.
describe.skipIf(!process.env.BRANCH_MIND_LIVE_TEST_CONFIG)("live DeepSeek course workflow", () => {
  const report: Record<string, unknown> = {
    provider: "DeepSeek",
    model: "deepseek-flash",
    checks: [],
  };
  const checks: string[] = [];
  const requests: Array<{
    messages: Array<{ role: string; content: string }>;
    responseFormat?: unknown;
  }> = [];
  const base = process.env.BRANCH_MIND_TEST_URL ?? "http://127.0.0.1:1666";
  let key = "";
  beforeAll(async () => {
    const providers = JSON.parse(readFileSync(process.env.BRANCH_MIND_LIVE_TEST_CONFIG!, "utf8"));
    key = providers[0].apiKeys[0].value;
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
      if (typeof url === "string" && url.startsWith("/")) {
        if (url === "/api/chat" && typeof init?.body === "string") {
          const body = JSON.parse(init.body);
          requests.push({ messages: body.messages, responseFormat: body.responseFormat });
        }
        return originalFetch(base + url, init);
      }
      return originalFetch(url, init);
    });
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    };
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("localStorage", storage);
    await deleteDB();
  });
  afterAll(() => {
    report.checks = checks;
    report.checkedAt = new Date().toISOString();
    writeFileSync("docs/live-validation.json", JSON.stringify(report, null, 2));
    vi.unstubAllGlobals();
  });
  it("validates model testing, streaming, chapter creation, refinement, teaching, consistency, and persistence", async () => {
    const testResponse = await fetch(base + "/api/providers/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.deepseek.com",
        apiKey: key,
        model: "deepseek-flash",
        prompt: "仅回复连接成功",
        timeout: 60000,
      }),
    });
    const test = await testResponse.json();
    expect(test.status).toBe("healthy");
    expect(test.content.length).toBeGreaterThan(0);
    checks.push("应用内模型测试返回有效正文");
    const healthResponse = await fetch(base + "/api/providers/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "live-deepseek",
        baseUrl: "https://api.deepseek.com",
        apiKeys: [{ id: "test-key", value: key, isPrimary: true }],
        timeout: 60000,
      }),
    });
    const health = await healthResponse.json();
    expect(health.status).toBe("healthy");
    checks.push("应用内服务连接检测通过");

    const stream = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.deepseek.com",
        apiKey: key,
        model: "deepseek-flash",
        messages: [{ role: "user", content: "仅回复连接成功" }],
        stream: true,
        maxTokens: 64,
      }),
    });
    const events = await stream.text();
    expect(stream.status).toBe(200);
    expect(events).toContain("[DONE]");
    expect(events).toContain('"content"');
    checks.push("应用内流式输出完成");
    const store = createAppStore();
    store.getState().loadProviders();
    store.getState().addApiKey(store.getState().providers[0].id, key);
    await store.getState().initialize();
    store.setState({
      longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
      draftToolUses: [],
      maxTokens: 1800,
    });
    await store.getState().updateTreeTitle(store.getState().currentTreeId!, "量子力学 · 集成测试");
    await store
      .getState()
      .generateStudyOutline(
        "为初学者规划量子力学，只创建两个互不重叠的章，第一个是量子态，第二个是测量。量子态 canExpand 为 true；测量只聚焦 Born 规则，可以直接学习。符号用 |ψ⟩ 和 ℏ，内积对第二个变量线性。",
      );
    const firstPlan = store.getState().getCurrentTree()!.learning!;
    expect(firstPlan.branches.filter((b) => b.kind === "lesson").length).toBeGreaterThanOrEqual(2);
    expect(firstPlan.notation).toContain("ℏ");
    checks.push("真实模型创建课程章节并保存符号约定");
    const parent = firstPlan.branches.find((b) => b.kind === "lesson" && b.canExpand)!;
    expect(parent).toBeDefined();
    await store.getState().selectStudyBranch(parent.id);
    await store
      .getState()
      .generateStudyOutline(
        "把本章拆成 2 个具体小节，每节能在一份讲义内讲清，不再细分，canExpand 必须为 false。",
      );
    const plan = store.getState().getCurrentTree()!.learning!;
    const leaves = plan.branches.filter((b) => b.parentBranchId === parent.id);
    expect(leaves.length).toBeGreaterThan(0);
    checks.push("真实模型创建章节子节");
    const leaf = leaves[0];
    await store.getState().selectStudyBranch(leaf.id);
    await store.getState().startStudyLesson();
    const lecture = store.getState().getActiveNode()!;
    expect(lecture.content.length).toBeGreaterThan(100);
    expect(
      store
        .getState()
        .getCurrentTree()!
        .learning!.branches.find((b) => b.id === leaf.id)!.started,
    ).toBe(true);
    checks.push("开始学习生成真实讲义");
    const other = firstPlan.branches.find((b) => b.kind === "lesson" && b.id !== parent.id)!;
    await store.getState().selectStudyBranch(other.id);
    await store.getState().startStudyLesson();
    const last = JSON.stringify(requests.at(-1)!.messages);
    expect(last).toContain(leaf.title);
    expect(last).toContain("内积");
    expect(
      requests
        .at(-1)!
        .messages.some((message) => message.content.includes(lecture.content.slice(0, 80))),
    ).toBe(true);
    checks.push("后续章节请求包含前节讲义和课程符号约定");
    const archive = await exportStudyArchive();
    validateArchive(archive);
    const restored = createAppStore();
    await restored.getState().initialize();
    expect(restored.getState().getCurrentTree()!.learning!.branches.length).toBe(
      plan.branches.length,
    );
    checks.push("章节树与讲义持久化及备份校验通过");
    report.chapters = plan.branches
      .filter((b) => b.kind === "lesson")
      .map((b) => ({ title: b.title, parent: b.parentBranchId, leaf: !b.canExpand }));
  }, 180000);
});
