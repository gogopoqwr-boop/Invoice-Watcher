import { Router } from "express";
import { db, watchConfigsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/configurations", async (req, res) => {
  try {
    const body = req.body;
    const sessionId = body.sessionId || `anon_${Math.random().toString(36).slice(2, 15)}`;
    const [config] = await db.insert(watchConfigsTable).values({
      sessionId,
      presetId: body.presetId ?? null,
      watchfaceGeometry: body.watchfaceGeometry ?? "circle",
      watchfaceMaterial: body.watchfaceMaterial ?? "metal",
      watchfaceColor: body.watchfaceColor ?? "#C0C0C0",
      watchfaceSize: body.watchfaceSize ?? "42mm",
      braceletMaterial: body.braceletMaterial ?? "metal_solid",
      braceletType: body.braceletType ?? "solid",
      braceletColor: body.braceletColor ?? "#888888",
      braceletWidth: body.braceletWidth ?? "20mm",
      braceletLength: body.braceletLength ?? "standard",
      closingMechanism: body.closingMechanism ?? "buckle",
      handsStyle: body.handsStyle ?? "baton",
      handsColor: body.handsColor ?? "#FFFFFF",
      handsEnabled: body.handsEnabled ?? true,
      serialNumber: body.serialNumber ?? null,
      customWatchfaceUrl: body.customWatchfaceUrl ?? null,
      customBackgroundUrl: body.customBackgroundUrl ?? null,
      skinFullUrl: body.skinFullUrl ?? null,
      skinStripeUrl: body.skinStripeUrl ?? null,
      boxType: body.boxType ?? "standard",
      boxColor: body.boxColor ?? "#1A1A1A",
    }).returning();
    res.status(201).json(config);
  } catch (err) {
    req.log.error({ err }, "Failed to create configuration");
    res.status(500).json({ error: "Failed to create configuration" });
  }
});

router.get("/configurations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [config] = await db.select().from(watchConfigsTable).where(eq(watchConfigsTable.id, id));
    if (!config) return res.status(404).json({ error: "Configuration not found" });
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Failed to get configuration");
    res.status(500).json({ error: "Failed to get configuration" });
  }
});

router.put("/configurations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const body = req.body;
    const updateData: Record<string, unknown> = {};
    const fields = [
      "watchfaceGeometry", "watchfaceMaterial", "watchfaceColor", "watchfaceSize",
      "braceletMaterial", "braceletType", "braceletColor", "braceletWidth", "braceletLength",
      "closingMechanism", "handsStyle", "handsColor", "handsEnabled", "serialNumber",
      "customWatchfaceUrl", "customBackgroundUrl", "skinFullUrl", "skinStripeUrl",
      "boxType", "boxColor"
    ];
    for (const f of fields) {
      if (f in body) updateData[f] = body[f];
    }
    const [updated] = await db.update(watchConfigsTable).set(updateData).where(eq(watchConfigsTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Configuration not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update configuration");
    res.status(500).json({ error: "Failed to update configuration" });
  }
});

export default router;
