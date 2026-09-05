import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import healthRouter from "./health";
import siteContentRouter from "./site-content";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(siteContentRouter);
router.use(adminRouter);
router.use(storageRouter);

export default router;
