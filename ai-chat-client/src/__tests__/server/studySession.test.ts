import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { POST } from "@/app/api/study-session/route";
const token = "branch-mind-session-test-0123456789";
let previous: string | undefined;
beforeEach(() => {
  previous = process.env.BRANCH_MIND_SYNC_TOKEN;
  process.env.BRANCH_MIND_SYNC_TOKEN = token;
});
afterEach(() => {
  if (previous === undefined) delete process.env.BRANCH_MIND_SYNC_TOKEN;
  else process.env.BRANCH_MIND_SYNC_TOKEN = previous;
});
describe("shared-space access", () => {
  it("protects the model and local tool APIs as well as the homepage", () => {
    expect(proxy(new NextRequest("http://localhost/api/tools/python")).status).toBe(401);
    expect(proxy(new NextRequest("http://localhost/")).headers.get("location")).toBe(
      "http://localhost/connect",
    );
    expect(proxy(new NextRequest("http://localhost/connect")).status).toBe(200);
  });
  it("accepts a valid cookie and rejects cross-origin writes", () => {
    const headers = { Cookie: `branchmind-session=${token}` };
    expect(proxy(new NextRequest("http://localhost/api/chat", { headers })).status).toBe(200);
    expect(
      proxy(
        new NextRequest("http://localhost/api/chat", {
          method: "POST",
          headers: { ...headers, Origin: "https://other.example" },
        }),
      ).status,
    ).toBe(403);
  });
  it("uses the actual Host header when NextURL normalizes a loopback hostname", () => {
    const request = new NextRequest("http://localhost:1667/api/chat", {
      method: "POST",
      headers: {
        Cookie: `branchmind-session=${token}`,
        Host: "127.0.0.1:1667",
        Origin: "http://127.0.0.1:1667",
      },
    });
    expect(proxy(request).status).toBe(200);
  });
  it("issues an HttpOnly same-site cookie only for the correct password", async () => {
    const wrong = await POST(
      new NextRequest("https://study.example/api/study-session", {
        method: "POST",
        body: JSON.stringify({ token: "incorrect" }),
      }),
    );
    expect(wrong.status).toBe(401);
    const response = await POST(
      new NextRequest("https://study.example/api/study-session", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
  });
});
