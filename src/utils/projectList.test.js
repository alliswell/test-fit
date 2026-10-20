import { describe, it, expect } from "vitest";
import { newProjectId, cleanName, projectMeta, splitChunks, memoryBackend, artifactDbBackend, backendCanWrite, pickBackend, slimProject, readActiveId, writeActiveId, ACTIVE_PROJECT_KEY } from "./projectList";

// A minimal in-memory stand-in for the artifact `db` capability: just enough of
// doc/collection/get/set/update/delete/orderBy for the backend to run end to end.
function fakeDb() {
  const docs = new Map();
  const doc = (path) => ({
    id: path.split("/").pop(),
    get: async () => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path) }),
    set: async (d) => { docs.set(path, JSON.parse(JSON.stringify(d))); },
    update: async (d) => { if (!docs.has(path)) throw { code: "invalid_argument", message: "missing" }; docs.set(path, { ...docs.get(path), ...d }); },
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

describe("ids, names and meta", () => {
  it("mints random, path-safe ids — the name is only a label", () => {
    const a = newProjectId(), b = newProjectId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^p_[a-z0-9]+_[a-z0-9]{6}$/);
    expect(newProjectId(1000, () => 0.5)).toBe("p_rs_i00000");
    expect(cleanName("  Midtown — Rev B ")).toBe("Midtown — Rev B");
    expect(cleanName("   ")).toBe("Untitled");
    expect(projectMeta("p_1", " Club A ", big, 5)).toMatchObject({ id: "p_1", name: "Club A", savedAt: 5 });
    expect(projectMeta("p_1", "Club A", big).summary).toMatch(/^300 walls/);
  });
  it("drops slide captures", () => {
    expect(slimProject(big).slides[0].image).toBeNull();
  });
  it("splits text into chunks and keeps an empty string as one chunk", () => {
    expect(splitChunks("abcdefg", 3)).toEqual(["abc", "def", "g"]);
    expect(splitChunks("", 3)).toEqual([""]);
  });
  it("remembers the active project per storage", () => {
    const s = new Map(); const storage = { getItem: (k) => s.get(k) ?? null, setItem: (k, v) => s.set(k, v), removeItem: (k) => s.delete(k) };
    expect(readActiveId(storage)).toBeNull();
    writeActiveId("p_1", storage); expect(readActiveId(storage)).toBe("p_1"); expect(s.get(ACTIVE_PROJECT_KEY)).toBe("p_1");
    writeActiveId(null, storage); expect(readActiveId(storage)).toBeNull();
    expect(readActiveId(null)).toBeNull(); // no storage at all
  });
});

describe("memoryBackend", () => {
  it("round-trips, lists newest first without data, renames and removes", async () => {
    const b = memoryBackend();
    await b.put(projectMeta("p_old", "Old", big, 1), big);
    await b.put(projectMeta("p_new", "New", big, 2), big);
    const list = await b.list();
    expect(list.map(p => p.name)).toEqual(["New", "Old"]);
    expect(list[0]).not.toHaveProperty("data");
    expect((await b.get("p_old")).walls).toHaveLength(300);
    await b.rename("p_old", " Older ");
    expect((await b.list()).find(p => p.id === "p_old")).toMatchObject({ name: "Older", savedAt: 1 });
    await expect(b.rename("nope", "x")).rejects.toThrow();
    await b.remove("p_old");
    expect(await b.get("p_old")).toBeNull();
  });
  it("two projects may share a name", async () => {
    const b = memoryBackend();
    await b.put(projectMeta(newProjectId(), "Midtown", big, 1), big);
    await b.put(projectMeta(newProjectId(), "Midtown", big, 2), big);
    expect(await b.list()).toHaveLength(2);
  });
});

describe("artifactDbBackend", () => {
  it("chunks a project across part docs and reassembles it", async () => {
    const db = fakeDb();
    const b = artifactDbBackend(db, { chunkChars: 5000 });
    await b.put(projectMeta("p_hall", "Hall", big, 10), big);
    const json = JSON.stringify(big);
    const expectedParts = Math.ceil(json.length / 5000);
    expect(expectedParts).toBeGreaterThan(1);
    expect(db.docs.get("projects/p_hall")).toMatchObject({ name: "Hall", savedAt: 10, chunks: expectedParts });
    expect(await b.get("p_hall")).toEqual(big);
    expect(await b.list()).toEqual([{ id: "p_hall", name: "Hall", savedAt: 10, summary: projectMeta("p_hall", "Hall", big).summary, chunks: expectedParts }]);
  });
  it("rename touches only the meta doc", async () => {
    const db = fakeDb();
    const b = artifactDbBackend(db, { chunkChars: 5000 });
    await b.put(projectMeta("p_hall", "Hall", big, 10), big);
    const partsBefore = [...db.docs.entries()].filter(([p]) => p.includes("/parts/")).map(([p, d]) => [p, d.s]);
    await b.rename("p_hall", "Great Hall");
    expect(db.docs.get("projects/p_hall")).toMatchObject({ name: "Great Hall", savedAt: 10 });
    expect([...db.docs.entries()].filter(([p]) => p.includes("/parts/")).map(([p, d]) => [p, d.s])).toEqual(partsBefore);
    await expect(b.rename("p_missing", "x")).rejects.toMatchObject({ code: "invalid_argument" });
  });
  it("a smaller re-save deletes the stale tail chunks; remove clears everything", async () => {
    const db = fakeDb();
    const b = artifactDbBackend(db, { chunkChars: 5000 });
    await b.put(projectMeta("p_hall", "Hall", big, 10), big);
    const small = { projectName: "Hall", walls: [] };
    await b.put(projectMeta("p_hall", "Hall", small, 11), small);
    const partPaths = [...db.docs.keys()].filter(p => p.startsWith("projects/p_hall/parts/"));
    expect(partPaths).toEqual(["projects/p_hall/parts/0"]);
    expect(await b.get("p_hall")).toEqual(small);
    await b.remove("p_hall");
    expect([...db.docs.keys()]).toEqual([]);
    expect(await b.get("p_hall")).toBeNull();
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
