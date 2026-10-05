import { upstreamFetch } from "@/lib/server/upstreamFetch";
import { NextResponse } from "next/server";

import {
  buildAuthHeaders,
  buildChatCompletionsUrl,
  createTimeoutController,
  parseProviderRequest,
} from "../utils";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseProviderRequest(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const payload = body as { model?: unknown; prompt?: unknown };
  const model =
    typeof payload.model === "string" && payload.model.trim()
      ? payload.model.trim()
      : "deepseek-flash";
  const prompt =
    typeof payload.prompt === "string" && payload.prompt.trim() ? payload.prompt.trim() : "hi";

  const { apiKey, baseUrl, headers, timeout } = parsed.data;
  const { signal, cancel } = createTimeoutController(timeout);
  const startTime = Date.now();

  try {
    const response = await upstreamFetch(buildChatCompletionsUrl(baseUrl), {
      method: "POST",
      headers: buildAuthHeaders(apiKey, headers),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 128,
        ...(new URL(baseUrl).hostname === "api.deepseek.com"
          ? { thinking: { type: "disabled" } }
          : {}),
      }),
      signal,
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const message =
        response.status === 401
          ? "errors.invalidApiKey"
          : `HTTP ${response.status}: ${response.statusText}`;
      return NextResponse.json({ status: "error", error: message, responseTime });
    }

    const json = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
    const content = json?.choices?.[0]?.message?.content ?? "";
    if (!content.trim())
      return NextResponse.json({
        status: "error",
        error: "模型连接成功，但没有返回正文，请增加输出预算或检查模型模式。",
        responseTime,
      });

    return NextResponse.json({ status: "healthy", responseTime, content });
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "errors.requestTimeout"
        : err instanceof Error
          ? err.message
          : "errors.unknownError";
    return NextResponse.json({ status: "error", error: message, responseTime });
  } finally {
    cancel();
  }
}
