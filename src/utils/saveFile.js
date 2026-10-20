// One door for every file the app hands the user (project JSON, PNG, SVG, DXF).
//
// In a normal browser it is the usual anchor download. Inside the claude.ai artifact
// viewer the sandbox makes page-started downloads inert (anchor clicks and script saves
// both silently do nothing), so when `window.claude.use` exists we ask for the viewer's
// `downloads` capability and hand the file to it — the viewer shows a confirm and the
// user may decline. Absent that capability we fall back to the anchor, which is all a
// plain page can do.
//
// The viewer also allowlists extensions; DXF is not on it, so a CAD file goes out as
// `name.dxf.txt` and the caller tells the user to rename it (see `renamed`).

const VIEWER_EXT_OK = /\.(gif|png|jpe?g|webp|mp4|webm|txt|json|md|docx|pptx|epub|csv|ttf|html|svg|pdf|xlsx|zip)$/i;

// Pure: the filename the artifact viewer will accept for `filename`.
export function viewerSafeName(filename) {
  return VIEWER_EXT_OK.test(filename) ? filename : filename + ".txt";
}

function anchorDownload(filename, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Resolves { status: "saved" | "declined", filename, renamed }. Never rejects for the
// user's own "no"; other capability errors fall back to the anchor path.
export async function saveFile(filename, data, type = "application/octet-stream") {
  const claude = globalThis.window?.claude;
  let downloads = null;
  if (claude && typeof claude.use === "function") {
    try { downloads = await claude.use("downloads"); } catch { downloads = null; }
  }
  if (!downloads) {
    anchorDownload(filename, data, type);
    return { status: "saved", filename, renamed: false };
  }
  const name = viewerSafeName(filename);
  try {
    await downloads.save({ filename: name, data });
    return { status: "saved", filename: name, renamed: name !== filename };
  } catch (e) {
    if (e?.code === "declined") return { status: "declined", filename: name, renamed: name !== filename };
    // Anything else (rate limit, unavailable mid-session): try the plain route so the
    // user at least gets the browser's own behaviour.
    anchorDownload(filename, data, type);
    return { status: "saved", filename, renamed: false };
  }
}
