// The in-app project list (utils/projectList.js) as React state for TestfitTool: picks
// the backend once on mount (artifact db when the page runs inside the claude.ai viewer,
// else IndexedDB), keeps the list and the ACTIVE project (the entry the editor is working
// on — Save updates it; see projectList.js IDENTITY), and exposes save / open / rename /
// delete with toasts.
//   getProjectData   → the full file payload (same as the .json export)
//   openData(data)   → hydrate it (the caller wraps applyProjectData + history push)
//   onProjectNamed(n)→ the editor's title should become n (after a save or an active rename)
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { pickBackend, backendCanWrite, projectMeta, slimProject, newProjectId, cleanName, readActiveId, writeActiveId } from "../utils/projectList";

export function useProjectList({ getProjectData, openData, onProjectNamed }) {
  const [backend, setBackend] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveState] = useState(() => readActiveId());
  const [canWrite, setCanWrite] = useState(true);
  const [busy, setBusy] = useState(false);
  const setActiveId = useCallback((id) => { setActiveState(id); writeActiveId(id); }, []);
  const clearActive = useCallback(() => setActiveId(null), [setActiveId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = await pickBackend();
      if (!alive) return;
      setBackend(b);
      setCanWrite(await backendCanWrite(b));
      try {
        const l = await b.list();
        if (!alive) return;
        setProjects(l);
        // A remembered binding to an entry that no longer exists (deleted elsewhere) is dropped.
        const stored = readActiveId();
        if (stored && !l.some(p => p.id === stored)) setActiveId(null);
      } catch (e) { console.warn("Project list unavailable:", e?.message); }
    })();
    return () => { alive = false; };
  }, [setActiveId]);

  const refresh = useCallback(async () => {
    if (!backend) return;
    try { setProjects(await backend.list()); } catch (e) { console.warn("Project list refresh failed:", e?.message); }
  }, [backend]);

  // Save updates the ACTIVE entry; asNew (or no active entry) mints a fresh id. Resolves
  // the saved meta, or null. The payload carries the name as projectName so the title
  // and the entry agree after a re-open.
  const saveProject = useCallback(async (name, { asNew = false } = {}) => {
    if (!backend) return null;
    const clean = cleanName(name);
    const data = slimProject({ ...getProjectData(), projectName: clean });
    const reuse = !asNew && activeId && projects.some(p => p.id === activeId);
    const meta = projectMeta(reuse ? activeId : newProjectId(), clean, data);
    setBusy(true);
    try {
      await backend.put(meta, data);
      setActiveId(meta.id);
      onProjectNamed?.(meta.name);
      await refresh();
      toast(reuse ? "Project updated" : "Project saved", { description: `${meta.name} · ${meta.summary}` });
      return meta;
    } catch (e) {
      toast.error("Couldn't save project", { description: e?.message || String(e) });
      return null;
    } finally { setBusy(false); }
  }, [backend, getProjectData, refresh, activeId, projects, setActiveId, onProjectNamed]);

  const openProject = useCallback(async (id) => {
    if (!backend) return false;
    setBusy(true);
    try {
      const data = await backend.get(id);
      if (!data) { toast.error("Project not found", { description: "It may have been deleted on another device." }); await refresh(); return false; }
      // The list entry's name is the truth (rename only touches the meta, never the
      // payload), so the editor's title follows it rather than the name at save time.
      const entry = projects.find(p => p.id === id);
      if (entry?.name) data.projectName = entry.name;
      openData(data);
      setActiveId(id);
      toast("Project opened", { description: data.projectName || id });
      return true;
    } catch (e) {
      toast.error("Couldn't open project", { description: e?.message || String(e) });
      return false;
    } finally { setBusy(false); }
  }, [backend, openData, refresh, setActiveId, projects]);

  const renameProject = useCallback(async (id, name) => {
    if (!backend) return false;
    const clean = cleanName(name);
    setBusy(true);
    try {
      await backend.rename(id, clean);
      if (id === activeId) onProjectNamed?.(clean);
      await refresh();
      toast("Project renamed", { description: clean });
      return true;
    } catch (e) {
      toast.error("Couldn't rename project", { description: e?.message || String(e) });
      return false;
    } finally { setBusy(false); }
  }, [backend, refresh, activeId, onProjectNamed]);

  const deleteProject = useCallback(async (id) => {
    if (!backend) return;
    setBusy(true);
    try {
      await backend.remove(id);
      if (id === activeId) setActiveId(null);
      await refresh();
      toast("Project deleted");
    } catch (e) { toast.error("Couldn't delete project", { description: e?.message || String(e) }); }
    finally { setBusy(false); }
  }, [backend, refresh, activeId, setActiveId]);

  return { projects, activeId, canWrite, busy, backendKind: backend?.kind ?? null, saveProject, openProject, renameProject, deleteProject, clearActive, refresh };
}
