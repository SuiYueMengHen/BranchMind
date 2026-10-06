import { describe, expect, it } from "vitest";
import { version } from "../../../package.json";
import { GET } from "@/app/api/status/route";

describe("local service status", () => {
  it("returns only public service identity without caching", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ app: "Branch Mind", version });
  });
});
