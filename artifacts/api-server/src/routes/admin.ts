import { Router, type IRouter } from "express";
import {
  clearAdminSessionCookie,
  clearFailedLogins,
  createAdminSession,
  isLoginRateLimited,
  recordFailedLogin,
  requireAdmin,
  revokeAdminSession,
  setAdminSessionCookie,
  verifyPassword,
} from "../lib/admin-auth";
import { createCmsUploadUrl } from "../lib/cms-storage";
import { uploadRequestSchema } from "../lib/site-content-schema";

const router: IRouter = Router();

router.get("/admin/access", (req, res) => {
  if (requireAdmin(req, res)) res.json({ authorized: true });
});

router.post("/admin/login", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (isLoginRateLimited(ip)) {
    res.status(429).json({ error: "Demasiadas tentativas. Tente novamente em 15 minutos." });
    return;
  }
  if (
    !req.body ||
    typeof req.body.password !== "string" ||
    req.body.password.length === 0
  ) {
    res.status(400).json({ error: "A palavra-passe é obrigatória." });
    return;
  }
  if (!verifyPassword(req.body.password)) {
    recordFailedLogin(ip);
    res.status(401).json({ error: "Palavra-passe inválida." });
    return;
  }
  const token = createAdminSession();
  if (!token) {
    res.status(503).json({ error: "A sessão de administrador não está configurada." });
    return;
  }
  clearFailedLogins(ip);
  setAdminSessionCookie(res, token);
  res.json({ authorized: true });
});

router.post("/admin/logout", (req, res) => {
  revokeAdminSession(req);
  clearAdminSessionCookie(res);
  res.status(204).end();
});

router.post("/admin/uploads/request-url", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = uploadRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid image upload metadata" });
    return;
  }
  try {
    res.json(await createCmsUploadUrl(parsed.data.contentType));
  } catch (error) {
    req.log.error({ err: error }, "Could not create CMS upload URL");
    res.status(503).json({ error: "Upload service is temporarily unavailable" });
  }
});

export default router;