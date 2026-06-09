import { Router } from "express";
import { db, watchPresetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/presets", async (req, res) => {
  try {
    const presets = await db.select().from(watchPresetsTable).orderBy(watchPresetsTable.id);
    res.json(presets);
  } catch (err) {
    req.log.error({ err }, "Failed to list presets");
    res.status(500).json({ error: "Failed to list presets" });
  }
});

router.get("/presets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [preset] = await db.select().from(watchPresetsTable).where(eq(watchPresetsTable.id, id));
    if (!preset) return res.status(404).json({ error: "Preset not found" });
    res.json(preset);
  } catch (err) {
    req.log.error({ err }, "Failed to get preset");
    res.status(500).json({ error: "Failed to get preset" });
  }
});

export default router;
