// ─── Wall CSG worker ─────────────────────────────────────────────────────────
// Runs buildWallSolidGeometry (extrude + three-bvh-csg opening subtraction) OFF the main
// thread. Each request carries a wall's local footprint quad, height and cuts; the reply
// carries the finished geometry's typed arrays, transferred (not copied). Nothing here is
// stateful between messages, so a failed evaluate only fails its own request.
import { buildWallSolidGeometry, geometryToTransferable } from "./wallGeo3d";

self.onmessage = (e) => {
  const { id, localQuad, heightFt, cuts, opts } = e.data;
  try {
    const geo = buildWallSolidGeometry(localQuad, heightFt, cuts, opts);
    const t = geometryToTransferable(geo);
    geo.dispose();
    const { buffers, ...payload } = t;
    self.postMessage({ id, ok: true, ...payload }, buffers);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
