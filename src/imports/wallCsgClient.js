// ─── Wall CSG client ─────────────────────────────────────────────────────────
// Main-thread side of wallCsg.worker.js: one lazily-created module worker shared by every
// Wall3D, request ids matched to promises. `csgWorkerAvailable()` is false under Node
// (vitest) and any browser without module workers, in which case callers fall back to the
// synchronous buildWallSolidGeometry — same output, just on the main thread.
let worker = null, seq = 0;
const pending = new Map();

export function csgWorkerAvailable() {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && !window.__TF_NO_CSG_WORKER;
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./wallCsg.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data); else p.reject(new Error(e.data.error || "wall CSG failed"));
  };
  worker.onerror = (err) => {
    // The worker itself died (failed to load, threw at top level): fail everything in
    // flight so callers fall back to the sync path, and rebuild lazily next time.
    for (const p of pending.values()) p.reject(err instanceof Error ? err : new Error(err?.message || "wall CSG worker error"));
    pending.clear();
    worker.terminate(); worker = null;
  };
  return worker;
}

// → Promise<{ position, normal, uv, index }> (typed arrays, owned by the caller).
export function buildWallSolidAsync(localQuad, heightFt, cuts, opts) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    try { getWorker().postMessage({ id, localQuad, heightFt, cuts, opts }); }
    catch (err) { pending.delete(id); reject(err); }
  });
}

export function pendingCsgRequests() { return pending.size; }
