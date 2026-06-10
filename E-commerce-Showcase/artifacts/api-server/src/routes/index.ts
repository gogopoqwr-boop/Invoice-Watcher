import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import reviewsRouter from "./reviews";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import botRouter from "./bot";
import authRouter from "./auth";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(authRouter);
router.use(analyticsRouter);
router.use(healthRouter);
router.use(productsRouter);
router.use(reviewsRouter);
router.use(cartRouter);
router.use(ordersRouter);
router.use(botRouter);

export default router;
