// The in-app project list (utils/projectList.js) as React state for TestfitTool: picks
// the backend once on mount (artifact db when the page runs inside the claude.ai viewer,
// else IndexedDB), keeps the list, and exposes save/open/delete with toasts.
//   getProjectData → the full file payload (same as the .json export)
//   openData(data) → hydrate it (the caller wraps applyProjectData + history push)
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { pickBackend, backendCanWrite, projectMeta, slimProject } from "../utils/projectList";

export function useProjectList({ getProjectData, openData }) {
  const [backend, setBackend] = useState(null);
  const [projects, setProjects] = useState([]);
  const [canWrite, setCanWrite] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = await pickBackend();
      if (!alive) return;
      setBackend(b);
      setCanWrite(await backendCanWrite(b));
      try { const l = await b.list(); if (alive) setProjects(l); } catch (e) { console.warn("Project list unavailable:", e?.message); }
    })();
    return () => { alive = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!backend) return;
    try { setProjects(await backend.list()); } catch (e) { console.warn("Project list refresh failed:", e?.message); }
  }, [backend]);

  // Resolves the saved meta, or null. The saved payload carries the list name as its
  // projectName so the title and the entry agree after a re-open.
  const saveProject = useCallback(async (name) => {
    if (!backend) return null;
    const data = slimProject({ ...getProjectData(), projectName: String(name || "").trim() || "Untitled" });
    const meta = projectMeta(data.projectName, data);
    setBusy(true);
    try {
      await backend.put(meta, data);
      await refresh();
      toast("Project saved", { description: `${meta.name} · ${meta.summary}` });
      return meta;
    } catch (e) {
      toast.error("Couldn't save project", { description: e?.message || String(e) });
      return null;
    } finally { setBusy(false); }
  }, [backend, getProjectData, refresh]);

  const openProject = useCallback(async (id) => {
    if (!backend) return false;
    setBusy(true);
    try {
      const data = await backend.get(id);
      if (!data) { toast.error("Project not found", { description: "It may have been deleted on another device." }); await refresh(); return false; }
      openData(data);
      toast("Project opened", { description: data.projectName || id });
      return true;
    } catch (e) {
      toast.error("Couldn't open project", { description: e?.message || String(e) });
      return false;
    } finally { setBusy(false); }
  }, [backend, openData, refresh]);

  const deleteProject = useCallback(async (id) => {
    if (!backend) return;
    setBusy(true);
    try { await backend.remove(id); await refresh(); toast("Project deleted"); }
    catch (e) { toast.error("Couldn't delete project", { description: e?.message || String(e) }); }
    finally { setBusy(false); }
  }, [backend, refresh]);

  return { projects, canWrite, busy, backendKind: backend?.kind ?? null, saveProject, openProject, deleteProject, refresh };
}
