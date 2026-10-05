import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAppStore } from "@/store/useStore";
import { deleteDB } from "@/lib/db/indexedDB";
import { getOpenAIBaseUrlOrDefault } from "@/lib/services/apiUrlService";
import { setStoredLLMSettings, DEFAULT_LLM_SETTINGS } from "@/lib/services/llmSettingsService";
import type { ChatParams } from "@/lib/services/llmService";
beforeEach(async () => {
  await deleteDB();
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
  vi.stubGlobal("window", { localStorage: storage });
  vi.stubGlobal("localStorage", storage);
});
afterEach(() => vi.unstubAllGlobals());
it("routes the default chat through the configured DeepSeek provider without a manual model selection", async () => {
  const chat = vi.fn(async (params: ChatParams) => {
    void params;
    return "已回答";
  });
  const store = createAppStore({ llmService: { chat } });
  store.getState().loadProviders();
  const provider = store.getState().providers[0]!;
  expect(provider.name).toBe("DeepSeek");
  expect(getOpenAIBaseUrlOrDefault()).toBe("https://api.deepseek.com");
  store.getState().addApiKey(provider.id, "test-deepseek-key");
  await store.getState().initialize();
  store.setState({
    longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
  });
  await store.getState().sendMessage("讲解线性空间");
  const request = chat.mock.calls.find(([p]) =>
    p.messages.some((m) => m.content === "讲解线性空间"),
  )![0];
  expect(request.model).toBe("deepseek-flash");
  expect(request.baseUrl).toBe("https://api.deepseek.com");
  expect(request.apiKey).toBe("test-deepseek-key");
});
it("upgrades an unconfigured old default while preserving an explicit model choice", () => {
  const store = createAppStore();
  store.getState().loadProviders();
  setStoredLLMSettings({ ...DEFAULT_LLM_SETTINGS, model: "gpt-4o-mini" });
  store.getState().hydrateLLMSettingsFromStorage();
  expect(store.getState().model).toBe("deepseek-flash");
  setStoredLLMSettings({ ...DEFAULT_LLM_SETTINGS, model: "custom-model" });
  store.getState().hydrateLLMSettingsFromStorage();
  expect(store.getState().model).toBe("custom-model");
});
