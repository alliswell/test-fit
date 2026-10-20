import { describe, it, expect } from "vitest";
import { projectId, projectMeta, splitChunks, memoryBackend, artifactDbBackend, backendCanWrite, pickBackend, slimProject } from "./projectList";

// A minimal in-memory stand-in for the artifact `db` capability: just enough of
// doc/collection/get/set/delete/orderBy for the backend to run end to end.
function fakeDb() {
  const docs = new Map();
  const doc = (path) => ({
    id: path.split("/").pop(),
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path) }),
    set: async (d) => { docs.set(path, JSON.parse(JSON.stringify(d))); },
    delete: async () => { docs.delete(path); },
    collection: (sub) => collection(`${path}/${sub}`),
  });
  const collection = (path) => {
    const depth = path.split("/").length;
    let order = null;
    const q = {
      doc: (id) => doc(`${path}/${id}`),
      orderBy: (f, dir) => { order = { f, dir }; return q; },
      get: async () => {
        const rows = [...docs.entries()].filter(([p]) => p.startsWith(path + "/") && p.split("/").length === depth + 1)
          .map(([p, d]) => ({ id: p.split("/").pop(), exists: true, data: () => d }));
        if (order) rows.sort((a, b) => (a.data()[order.f] - b.data()[order.f]) * (order.dir === "desc" ? -1 : 1));
        return { docs: rows };
      },
    };
    return q;
  };
  return { doc, collection, docs };
}

const big = { projectName: "Hall", walls: Array.from({ length: 300 }, (_, i) => ({ id: "w" + i, a: "n" + i, b: "n" + (i + 1), kind: "new", t: 0.5 })), slides: [{ id: "s1", image: "data:image/jpeg;base64,AAAA" }] };

describe("project ids and meta", () => {
  it("slugs the name so the same name updates the same entry", () => {
    expect(projectId("Midtown Club — Rev B")).toBe("midtown-club-rev-b");
    expect(projectId("   ")).toBe("untitled");
    expect(projectMeta(" Club A ", big, 5).name).toBe("Club A");
    expect(projectMeta("Club A", big, 5)).toMatchObject({ id: "club-a", savedAt: 5 });
    expect(projectMeta("Club A", big).summary).toMatch(/^300 walls/);
  });
  it("drops slide captures", () => {
    expect(slimProject(big).slides[0].image).toBeNull();
  });
  it("splits text into chunks and keeps an empty string as one chunk", () => {
    expect(splitChunks("abcdefg", 3)).toEqual(["abc", "def", "g"]);
    expect(splitChunks("", 3)).toEqual([""]);
  });
});

describe("memoryBackend", () => {
  it("round-trips and lists newest first without data", async () => {
    const b = memoryBackend();
    await b.put(projectMeta("Old", big, 1), big);
    await b.put(projectMeta("New", big, 2), big);
    const list = await b.list();
    expect(list.map(p => p.name)).toEqual(["New", "Old"]);
    expect(list[0]).not.toHaveProperty("data");
    expect((await b.get("old")).walls).toHaveLength(300);
    await b.remove("old");
    expect(await b.get("old")).toBeNull();
  });
});

describe("artifactDbBackend", () => {
  it("chunks a project across part docs and reassembles it", async () => {
    const db = fakeDb();
    const b = artifactDbBackend(db, { chunkChars: 5000 });
    await b.put(projectMeta("Hall", big, 10), big);
    const json = JSON.stringify(big);
    const expectedParts = Math.ceil(json.length / 5000);
    expect(expectedParts).toBeGreaterThan(1);
    expect(db.docs.get("projects/hall")).toMatchObject({ name: "Hall", savedAt: 10, chunks: expectedParts });
    expect(await b.get("hall")).toEqual(big);
    expect(await b.list()).toEqual([{ id: "hall", name: "Hall", savedAt: 10, summary: projectMeta("Hall", big).summary, chunks: expectedParts }]);
  });
  it("a smaller re-save deletes the stale tail chunks; remove clears everything", async () => {
    const db = fakeDb();
    const b = artifactDbBackend(db, { chunkChars: 5000 });
    await b.put(projectMeta("Hall", big, 10), big);
    const small = { projectName: "Hall", walls: [] };
    await b.put(projectMeta("Hall", small, 11), small);
    const partPaths = [...db.docs.keys()].filter(p => p.startsWith("projects/hall/parts/"));
    expect(partPaths).toEqual(["projects/hall/parts/0"]);
    expect(await b.get("hall")).toEqual(small);
    await b.remove("hall");
    expect([...db.docs.keys()]).toEqual([]);
    expect(await b.get("hall")).toBeNull();
  });
});

describe("backend selection", () => {
  it("prefers the artifact db when claude.use resolves it", async () => {
    const db = fakeDb();
    const claude = { use: async (n) => (n === "db" ? db : null) };
    expect((await pickBackend(claude)).kind).toBe("shared");
    expect((await pickBackend({ use: async () => null })).kind).toBe("memory"); // node: no IndexedDB
    expect((await pickBackend(undefined)).kind).toBe("memory");
  });
  it("write gating follows user.can('data.write'); unknown keeps the controls", async () => {
    const shared = { kind: "shared" };
    expect(await backendCanWrite(shared, { use: async () => ({ can: async () => false }) })).toBe(false);
    expect(await backendCanWrite(shared, { use: async () => ({ can: async () => null }) })).toBe(true);
    expect(await backendCanWrite(shared, { use: async () => null })).toBe(true);
    expect(await backendCanWrite({ kind: "local" })).toBe(true);
  });
});
