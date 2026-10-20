import { describe, it, expect, afterEach } from "vitest";
import { viewerSafeName, saveFile } from "./saveFile";

describe("viewerSafeName", () => {
  it("keeps allowlisted extensions", () => {
    expect(viewerSafeName("club.json")).toBe("club.json");
    expect(viewerSafeName("club.svg")).toBe("club.svg");
    expect(viewerSafeName("club.PNG")).toBe("club.PNG");
  });
  it("suffixes .txt for extensions the viewer refuses (DXF)", () => {
    expect(viewerSafeName("club.dxf")).toBe("club.dxf.txt");
    expect(viewerSafeName("noext")).toBe("noext.txt");
  });
});

describe("saveFile inside the artifact viewer", () => {
  afterEach(() => { delete globalThis.window; });

  it("routes through the downloads capability and reports a rename", async () => {
    const calls = [];
    globalThis.window = { claude: { use: async (n) => n === "downloads" ? { save: async (r) => { calls.push(r); return { status: "saved" }; } } : null } };
    const r = await saveFile("plan.dxf", "0\nSECTION", "application/dxf");
    expect(calls).toEqual([{ filename: "plan.dxf.txt", data: "0\nSECTION" }]);
    expect(r).toEqual({ status: "saved", filename: "plan.dxf.txt", renamed: true });
  });

  it("reports a decline without throwing", async () => {
    globalThis.window = { claude: { use: async () => ({ save: async () => { throw { code: "declined" }; } }) } };
    const r = await saveFile("plan.json", "{}", "application/json");
    expect(r.status).toBe("declined");
  });
});
