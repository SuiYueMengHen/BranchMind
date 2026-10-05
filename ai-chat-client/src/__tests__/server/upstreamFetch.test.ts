import { afterEach, expect, it, vi } from "vitest";
import { upstreamFetch } from "@/lib/server/upstreamFetch";
afterEach(() => vi.unstubAllGlobals());
it("retries a connection timeout once without retrying HTTP errors", async () => {
  const failure = new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
  const fetchMock = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
  expect(await (await upstreamFetch("https://api.deepseek.com/models")).text()).toBe("ok");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fetchMock.mockClear().mockResolvedValue(new Response("invalid key", { status: 401 }));
  expect((await upstreamFetch("https://api.deepseek.com/models")).status).toBe(401);
  expect(fetchMock).toHaveBeenCalledOnce();
});
it("reports a DNS error without leaking request headers or credentials", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } })),
  );
  await expect(
    upstreamFetch("https://api.deepseek.com/models", {
      headers: { Authorization: "Bearer private-test-key" },
    }),
  ).rejects.toThrow("ENOTFOUND");
  expect(JSON.stringify(log.mock.calls)).not.toContain("private-test-key");
  log.mockRestore();
});
it("does not retry TLS verification failures", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetchMock = vi
    .fn()
    .mockRejectedValue(new TypeError("fetch failed", { cause: { code: "CERT_HAS_EXPIRED" } }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(upstreamFetch("https://api.deepseek.com/models")).rejects.toThrow("TLS");
  expect(fetchMock).toHaveBeenCalledOnce();
});
