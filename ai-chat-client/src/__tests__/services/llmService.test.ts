import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LLMService } from "@/lib/services/llmService";

function createLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  } as unknown as Storage;

  return { localStorageMock, store };
}

describe("LLMService", () => {
  beforeEach(() => {
    const { localStorageMock, store } = createLocalStorageMock();
    store.set("new-chat.openai_api_key", "sk-test");
    store.set("new-chat.openai_base_url", "https://example.com/openai/v1");

    vi.stubGlobal("window", { localStorage: localStorageMock } as unknown as Window);
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/chat with apiKey + params and returns content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: "ok" }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = new LLMService();
    const content = await service.chat({
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-test",
      temperature: 0.5,
      maxTokens: 123,
    });

    expect(content).toBe("ok");

    const args = fetchMock.mock.calls[0];
    expect(args?.[0]).toBe("/api/chat");
    const init = args?.[1] as { body?: string };
    const body = JSON.parse(init.body ?? "{}") as {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      maxTokens?: number;
    };
    expect(body.apiKey).toBe("sk-test");
    expect(body.baseUrl).toBe("https://example.com/openai/v1");
    expect(body.model).toBe("gpt-test");
    expect(body.maxTokens).toBe(123);
  });

  it("omits maxTokens from request body when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: "ok" }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = new LLMService();
    await service.chat({
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-test",
    });

    const args = fetchMock.mock.calls[0];
    const init = args?.[1] as { body?: string };
    const body = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(body, "maxTokens")).toBe(false);
  });

  it("throws when api key is missing", async () => {
    const { localStorageMock } = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage: localStorageMock } as unknown as Window);
    vi.stubGlobal("localStorage", localStorageMock);

    const service = new LLMService();
    await expect(service.chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /Missing OpenAI API key/,
    );
  });

  it("throws when /api/chat returns non-OK", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = new LLMService();
    await expect(service.chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      "boom",
    );
  });

  it("explains Safari Load failed without retrying a paid request", async () => {
    const request = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    vi.stubGlobal("fetch", request);
    await expect(new LLMService().chat({ messages: [] })).rejects.toThrow("npm run start:local");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("preserves user cancellation", async () => {
    const error = new DOMException("Cancelled", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(new LLMService().chat({ messages: [] })).rejects.toBe(error);
  });

  it("throws when response payload is invalid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ nope: true }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = new LLMService();
    await expect(service.chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /Invalid LLM response/,
    );
  });
});

describe("stream integrity", () => {
  afterEach(() => vi.unstubAllGlobals());
  function mockStream(text: string) {
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { headers: { "Content-Type": "text/event-stream" } })),
    );
  }
  const params = {
    apiKey: "mock-key",
    baseUrl: "https://example.com",
    messages: [{ role: "user" as const, content: "讲解" }],
    stream: true,
  };
  it("keeps split Chinese UTF-8 bytes and a final event without a blank terminator", async () => {
    mockStream(
      'data: {"choices":[{"delta":{"content":"中文讲义：$$"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"x=1$$"},"finish_reason":"stop"}]}',
    );
    const chunks: string[] = [];
    const result = await new LLMService().chat({ ...params, onToken: (s) => chunks.push(s) });
    expect(result).toBe("中文讲义：$$x=1$$");
    expect(chunks.join("")).toBe(result);
    expect(result).not.toContain("�");
  });
  it("reports length truncation while keeping delivered partial tokens", async () => {
    mockStream(
      'data: {"choices":[{"delta":{"content":"$$x"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n',
    );
    const chunks: string[] = [];
    await expect(
      new LLMService().chat({ ...params, onToken: (s) => chunks.push(s) }),
    ).rejects.toThrow("长度上限");
    expect(chunks.join("")).toBe("$$x");
  });
  it("reports malformed SSE instead of silently dropping closing tokens", async () => {
    mockStream("data: {broken json}\n\n");
    await expect(new LLMService().chat(params)).rejects.toThrow("数据流格式异常");
  });
  it("detects unexpected stream termination", async () => {
    mockStream('data: {"choices":[{"delta":{"content":"未完成"}}]}\n\n');
    await expect(new LLMService().chat(params)).rejects.toThrow("意外中断");
  });

  it("reports a dropped connection and keeps the received text", async () => {
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (reads++ === 0) {
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"已接收讲义"}}]}\n\n'),
          );
        } else controller.error(new TypeError("Load failed"));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body)),
    );
    const chunks: string[] = [];
    await expect(
      new LLMService().chat({ ...params, onToken: (s) => chunks.push(s) }),
    ).rejects.toThrow("模型输出连接中断");
    expect(chunks.join("")).toBe("已接收讲义");
  });
});
