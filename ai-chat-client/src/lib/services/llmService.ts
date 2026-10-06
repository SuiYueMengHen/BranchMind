import type { ChatMessage } from "@/types";

import { getOpenAIApiKey } from "./apiKeyService";
import { getOpenAIBaseUrlOrDefault } from "./apiUrlService";

function connectionError(error: unknown, signal: AbortSignal | undefined, receiving = false) {
  if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) return error;
  if (!(error instanceof TypeError)) return error;
  return new Error(
    receiving
      ? "模型输出连接中断，已接收的内容会保留。请检查本地服务和网络后重试。"
      : "无法连接 Branch Mind 本地服务。请确认服务已启动（npm run start:local），并检查网络连接后重试。",
    { cause: error },
  );
}

export interface ChatParams {
  messages: ChatMessage[];
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: unknown;
  stream?: boolean;
  onToken?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface ILLMService {
  chat(params: ChatParams): Promise<string>;
}

/**
 * Client-side LLM service that proxies to our Next.js API route.
 * The OpenAI API key is stored locally (localStorage) and sent per-request.
 */
export class LLMService implements ILLMService {
  async chat(params: ChatParams): Promise<string> {
    const {
      apiKey: apiKeyOverride,
      baseUrl: baseUrlOverride,
      onToken,
      stream,
      signal,
      ...rest
    } = params;
    const apiKey = apiKeyOverride ?? getOpenAIApiKey();
    if (!apiKey) {
      throw new Error("Missing OpenAI API key. Add it in Settings.");
    }

    const baseUrl = baseUrlOverride ?? getOpenAIBaseUrlOrDefault();
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl, ...rest, stream: Boolean(stream) }),
      signal,
    }).catch((error: unknown) => {
      throw connectionError(error, signal);
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let message = text;
      try {
        const json = JSON.parse(text) as { error?: string };
        message = json.error ?? text;
      } catch {
        /* Plain-text HTTP error. */
      }
      throw new Error(message || `模型请求失败（HTTP ${response.status}）`);
    }

    if (stream) {
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.body || contentType.includes("application/json")) {
        const json = (await response.json().catch((error: unknown) => {
          throw connectionError(error, signal, true);
        })) as unknown;
        if (
          typeof json === "object" &&
          json !== null &&
          "content" in json &&
          typeof (json as { content: unknown }).content === "string"
        ) {
          const content = (json as { content: string }).content;
          onToken?.(content);
          return content;
        }
        throw new Error("Invalid LLM response payload.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let buffer = "";
      let content = "";
      let done = false;
      let finishReason: string | null = null;
      function processEvent(event: string) {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s*/, ""))
          .join("\n");
        if (!data) return;
        if (data === "[DONE]") {
          done = true;
          return;
        }
        let json: {
          choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
          error?: { message?: string };
        };
        try {
          json = JSON.parse(data);
        } catch {
          throw new Error("模型输出的数据流格式异常，请重试；已接收内容已保留。");
        }
        if (json.error) throw new Error(json.error.message || "模型输出中断，请重试");
        const choice = json.choices?.[0];
        finishReason = choice?.finish_reason ?? finishReason;
        const delta = choice?.delta?.content;
        if (typeof delta === "string" && delta) {
          content += delta;
          onToken?.(delta);
        }
      }
      try {
        while (!done) {
          const result = await reader.read();
          buffer += result.done ? decoder.decode() : decoder.decode(result.value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? "";
          for (const event of events) {
            processEvent(event);
            if (done) break;
          }
          if (result.done) {
            if (!done && buffer.trim()) processEvent(buffer);
            break;
          }
        }
        if (finishReason === "length")
          throw new Error(
            "输出达到模型长度上限，讲义可能不完整；可点击继续讲解，或提高设置中的输出长度。",
          );
        if (finishReason === "content_filter") throw new Error("模型停止了输出，讲义可能不完整。");
        if (!done && !finishReason) throw new Error("模型输出意外中断，内容可能不完整，请重试。");
      } catch (error) {
        throw connectionError(error, signal, true);
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }

      return content;
    }

    const json = (await response.json().catch((error: unknown) => {
      throw connectionError(error, signal, true);
    })) as unknown;
    if (
      typeof json === "object" &&
      json !== null &&
      "content" in json &&
      typeof (json as { content: unknown }).content === "string"
    ) {
      return (json as { content: string }).content;
    }

    throw new Error("Invalid LLM response payload.");
  }
}
