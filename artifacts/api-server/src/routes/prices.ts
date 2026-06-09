import { Router } from "express";

const router = Router();

const BASE_PRICE = 5;

const MATERIAL_PRICES: Record<string, number> = {
  plastic: 0,
  metal: 3,
};

const BRACELET_PRICES: Record<string, number> = {
  plastic_solid: 0,
  plastic_segmented: 1,
  metal_solid: 3,
  metal_segmented: 4,
  resin: 2,
  leather: 3,
  cotton_fabric: 1,
};

router.post("/prices/calculate", (req, res) => {
  const { watchfaceMaterial, braceletMaterial, handsEnabled, customWatchfaceUrl, skinFullUrl, skinStripeUrl, boxType } = req.body;

  const breakdown: Array<{ label: string; stars: number }> = [];

  breakdown.push({ label: "Базовая цена", stars: BASE_PRICE });

  const faceMat = MATERIAL_PRICES[watchfaceMaterial] ?? 0;
  if (faceMat > 0) breakdown.push({ label: `Циферблат (${watchfaceMaterial})`, stars: faceMat });

  const braceletPrice = BRACELET_PRICES[braceletMaterial] ?? 0;
  if (braceletPrice > 0) breakdown.push({ label: `Браслет (${braceletMaterial})`, stars: braceletPrice });

  if (handsEnabled === false) breakdown.push({ label: "Без стрелок (-1)", stars: -1 });

  if (customWatchfaceUrl) breakdown.push({ label: "Кастомный циферблат", stars: 1 });
  if (skinFullUrl) breakdown.push({ label: "Скин на весь корпус", stars: 1 });
  if (skinStripeUrl) breakdown.push({ label: "Скин на браслет", stars: 1 });

  if (boxType && boxType !== "standard") breakdown.push({ label: "Премиум коробка", stars: 2 });

  const total = Math.max(1, breakdown.reduce((sum, item) => sum + item.stars, 0));

  res.json({ totalStars: total, breakdown });
});

export default router;
