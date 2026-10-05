import { Agent, EnvHttpProxyAgent, type Dispatcher } from "undici";

const direct = new Agent({
  connect: { timeout: 30_000, autoSelectFamily: true },
  headersTimeout: 180_000,
});
const ipv4 = new Agent({ connect: { timeout: 30_000, family: 4 }, headersTimeout: 180_000 });
let proxy: EnvHttpProxyAgent | undefined;
function dispatcher(fallback: boolean): Dispatcher {
  if (
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy
  ) {
    proxy ??= new EnvHttpProxyAgent({ connect: { timeout: 30_000 } });
    return proxy;
  }
  return fallback ? ipv4 : direct;
}
function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const value = error as { code?: string; cause?: { code?: string } };
  return value.cause?.code ?? value.code ?? "UNKNOWN";
}
export function networkErrorMessage(error: unknown, host: string): string {
  const code = errorCode(error);
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))
    return `连接 ${host} 超时，请稍后重试或检查代理。`;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN")
    return `无法解析 ${host}（${code}），请检查 DNS 或网络。`;
  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT")
    return `连接 ${host} 超时（${code}），请检查网络或为服务进程配置 HTTPS_PROXY。`;
  if (/CERT|TLS|SSL/.test(code)) return `连接 ${host} 的 TLS 验证失败（${code}）。`;
  return `无法连接 ${host}（${code}），请检查网络与服务地址。`;
}
/** Only retry connection failures before an HTTP response; never retry paid HTTP errors or interrupted streams. */
export async function upstreamFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const signal = init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(180_000)])
    : AbortSignal.timeout(180_000);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetch(url, {
        ...init,
        signal,
        dispatcher: dispatcher(attempt > 0),
      } as RequestInit & { dispatcher: Dispatcher });
    } catch (error) {
      const code = errorCode(error);
      if (
        attempt === 0 &&
        !signal.aborted &&
        ["UND_ERR_CONNECT_TIMEOUT", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(
          code,
        )
      )
        continue;
      const host = new URL(url).hostname;
      // Deliberately log no request body, URL query, headers, or credentials.
      console.error("[Branch Mind upstream]", { host, code, attempts: attempt + 1 });
      throw new Error(networkErrorMessage(error, host));
    }
  }
  throw new Error("模型连接失败");
}
