import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, siteContentTable } from "@workspace/db";
import { requireAdmin } from "../lib/admin-auth";
import { siteContentSchema } from "../lib/site-content-schema";

const router: IRouter = Router();

router.get("/site-content", async (req, res) => {
  try {
    const [record] = await db
      .select()
      .from(siteContentTable)
      .where(eq(siteContentTable.id, 1))
      .orderBy(desc(siteContentTable.updatedAt))
      .limit(1);
    res.json({ content: record ? record.content : null });
  } catch (error) {
    req.log.error({ err: error }, "Could not load site content");
    res.status(503).json({ error: "Site content is temporarily unavailable" });
  }
});

router.put("/admin/site-content", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const parsed = siteContentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid site content document" });
    return;
  }

  try {
    const [record] = await db
      .insert(siteContentTable)
      .values({ id: 1, content: parsed.data, updatedBy: "shared-admin" })
      .onConflictDoUpdate({
        target: siteContentTable.id,
        set: { content: parsed.data, updatedBy: "shared-admin", updatedAt: new Date() },
      })
      .returning();
    res.json({ content: parsed.data, updatedAt: record.updatedAt.toISOString() });
  } catch (error) {
    req.log.error({ err: error }, "Could not save site content");
    res.status(503).json({ error: "Site content could not be saved" });
  }
});

export default router;