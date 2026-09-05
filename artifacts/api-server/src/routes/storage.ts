import { Router, type IRouter } from "express";
import { getCmsAsset } from "../lib/cms-storage";

const router: IRouter = Router();

router.get("/storage/objects/*objectPath", async (req, res) => {
  const rawPath = req.params.objectPath;
  const objectPath = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
  if (!objectPath) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  try {
    const file = await getCmsAsset(objectPath);
    if (!file) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
    file.createReadStream().on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "Asset not found" });
      else res.destroy();
    }).pipe(res);
  } catch (error) {
    req.log.error({ err: error }, "Could not stream CMS asset");
    if (!res.headersSent) res.status(503).json({ error: "Asset service is temporarily unavailable" });
  }
});

export default router;