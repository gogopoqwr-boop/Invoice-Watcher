import { Router, type IRouter } from "express";
import healthRouter from "./health";
import presetsRouter from "./presets";
import configurationsRouter from "./configurations";
import pricesRouter from "./prices";
import ordersRouter from "./orders";
import analyticsRouter from "./analytics";
import authRouter from "./auth";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(presetsRouter);
router.use(configurationsRouter);
router.use(pricesRouter);
router.use(ordersRouter);
router.use(analyticsRouter);
router.use(authRouter);
router.use(botRouter);

export default router;
