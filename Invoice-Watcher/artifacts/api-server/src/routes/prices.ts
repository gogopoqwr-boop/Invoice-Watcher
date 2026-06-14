import { Router } from "express";
import { buildBreakdown } from "../lib/receipt.js";

const router = Router();

router.post("/prices/calculate", (req, res) => {
  const { watchfaceGeometry, watchfaceMaterial, braceletMaterial, handsEnabled,
    watchfaceText, customWatchfaceUrl, skinFullUrl, skinStripeUrl, boxType, giftWrap } = req.body;

  const { breakdown, total } = buildBreakdown({
    watchfaceGeometry,
    watchfaceMaterial,
    braceletMaterial,
    handsEnabled,
    watchfaceText,
    customWatchfaceUrl,
    skinFullUrl,
    skinStripeUrl,
    boxType,
    giftWrap,
  });

  res.json({ totalStars: total, breakdown });
});

export default router;
