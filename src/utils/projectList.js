// ─── Project list ─────────────────────────────────────────────────────────────
// Named projects saved IN the app, so moving between them never means exporting a
// .json and loading it back. One tiny backend contract, two backends:
//
//   list()        → [{ id, name, savedAt, summary }]  newest first (no data — cheap)
//   get(id)       → project data | null
//   put(meta, data)
//   remove(id)
//
//   artifactDbBackend — the claude.ai artifact's shared `db` capability: one list for
//                       everyone who can open the artifact, on every device. Documents
//                       cap at 256 KiB and a project can be bigger, so the JSON text is
//                       split into `projects/<id>/parts/<i>` chunk docs under a small
//                       `projects/<id>` meta doc ({name, savedAt, summary, chunks}).
//   indexedDbBackend  — the browser's IndexedDB (dev build, or an artifact view without
//                       db): per browser, effectively unlimited size.
//   memoryBackend     — tests.
//
// pickBackend() chooses: artifact db when `claude.use("db")` resolves, else IndexedDB.
// A project's id is a slug of its name, so saving under an existing name UPDATES that
// entry (no dialogs — the viewer sandbox swallows confirm()).
import { historySummary, slimForHistory } from "./autosaveHistory";

export const PROJECTS_COLLECTION = "projects";
export const CHUNK_CHARS = 120_000; // ≈ 160 KiB after JSON escaping, well under 256 KiB

export function projectId(name) {
  const slug = String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

export function projectMeta(name, data, now = Date.now()) {
  const clean = String(name || "").trim() || "Untitled";
  return { id: projectId(clean), name: clean, savedAt: now, summary: historySummary(data) };
}

// Slide 3D captures are dropped (they re-capture on open) — same as autosave history.
export function slimProject(data) { return slimForHistory(data); }

export function splitChunks(str, size = CHUNK_CHARS) {
  const out = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out.length ? out : [""];
}

export function memoryBackend(map = new Map()) {
  return {
    kind: "memory",
    list: async () => [...map.values()].map(({ data, ...meta }) => meta).sort((a, b) => b.savedAt - a.savedAt),
    get: async (id) => (map.has(id) ? JSON.parse(JSON.stringify(map.get(id).data)) : null),
    put: async (meta, data) => { map.set(meta.id, { ...meta, data: JSON.parse(JSON.stringify(data)) }); },
    remove: async (id) => { map.delete(id); },
  };
}

export function indexedDbBackend(dbName = "testfit-projects") {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("projects", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const run = async (mode, op) => {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction("projects", mode);
      const req = op(tx.objectStore("projects"));
      tx.oncomplete = () => { db.close(); res(req?.result); };
      tx.onerror = () => { db.close(); rej(tx.error); };
      tx.onabort = () => { db.close(); rej(tx.error); };
    });
  };
  return {
    kind: "local",
    list: async () => ((await run("readonly", s => s.getAll())) || []).map(({ data, ...meta }) => meta).sort((a, b) => b.savedAt - a.savedAt),
    get: async (id) => (await run("readonly", s => s.get(id)))?.data ?? null,
    put: (meta, data) => run("readwrite", s => s.put({ ...meta, data })),
    remove: (id) => run("readwrite", s => s.delete(id)),
  };
}

export function artifactDbBackend(db, { chunkChars = CHUNK_CHARS } = {}) {
  const metaDoc = (id) => db.doc(`${PROJECTS_COLLECTION}/${id}`);
  const partDoc = (id, i) => metaDoc(id).collection("parts").doc(String(i));
  const chunkCount = async (id) => { const m = await metaDoc(id).get(); return m.exists ? (m.data().chunks || 0) : 0; };
  return {
    kind: "shared",
    list: async () => {
      const snap = await db.collection(PROJECTS_COLLECTION).orderBy("savedAt", "desc").get();
      return snap.docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }));
    },
    get: async (id) => {
      const n = await chunkCount(id);
      if (!n) return null;
      const snaps = await Promise.all(Array.from({ length: n }, (_, i) => partDoc(id, i).get()));
      return JSON.parse(snaps.map(s => s.data()?.s ?? "").join(""));
    },
    put: async (meta, data) => {
      const chunks = splitChunks(JSON.stringify(data), chunkChars);
      const prevN = await chunkCount(meta.id);
      // Parts first, meta last: a reader that sees the meta sees whole parts. One write
      // at a time — the store budgets concurrent writes.
      for (let i = 0; i < chunks.length; i++) await partDoc(meta.id, i).set({ s: chunks[i] });
      await metaDoc(meta.id).set({ name: meta.name, savedAt: meta.savedAt, summary: meta.summary, chunks: chunks.length });
      for (let i = chunks.length; i < prevN; i++) await partDoc(meta.id, i).delete(); // a smaller save leaves no stale tail
    },
    remove: async (id) => {
      const n = await chunkCount(id);
      await metaDoc(id).delete();
      for (let i = 0; i < n; i++) await partDoc(id, i).delete();
    },
  };
}

// Can this viewer write the shared list? Local backends: always. Artifact db: ask the
// `user` capability; `null` means "not told" — keep the controls and let a refused write
// decide (the db contract's own guidance).
export async function backendCanWrite(backend, claude = globalThis.window?.claude) {
  if (backend?.kind !== "shared") return true;
  try {
    const user = await claude.use("user");
    const w = await user?.can?.("data.write");
    return w !== false;
  } catch { return true; }
}

export async function pickBackend(claude = globalThis.window?.claude) {
  if (claude && typeof claude.use === "function") {
    try { const db = await claude.use("db"); if (db) return artifactDbBackend(db); } catch { /* fall through */ }
  }
  if (typeof indexedDB !== "undefined") return indexedDbBackend();
  return memoryBackend();
}
