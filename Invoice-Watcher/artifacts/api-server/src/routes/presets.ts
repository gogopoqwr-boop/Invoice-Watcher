import { Router } from "express";
import { db, watchPresetsTable, watchConfigsTable, ordersTable, presetCommentsTable } from "@workspace/db";
import { eq, desc, inArray, and, count } from "drizzle-orm";

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

router.get("/presets/inventory", async (req, res) => {
  try {
    const presets = await db.select({
      id: watchPresetsTable.id,
      collectionName: watchPresetsTable.collectionName,
      maxQuantity: watchPresetsTable.maxQuantity,
    }).from(watchPresetsTable);

    const collections = [...new Set(presets.map(p => p.collectionName).filter(Boolean))] as string[];
    const byCollection: Record<string, { sold: number; max: number }> = {};

    for (const collection of collections) {
      const collectionPresets = presets.filter(p => p.collectionName === collection);
      const maxQuantity = collectionPresets[0]?.maxQuantity ?? 1000;
      const presetIds = collectionPresets.map(p => p.id);

      const [{ value: soldCount }] = await db
        .select({ value: count() })
        .from(ordersTable)
        .innerJoin(watchConfigsTable, eq(ordersTable.configId, watchConfigsTable.id))
        .where(
          and(
            inArray(watchConfigsTable.presetId as any, presetIds),
            inArray(ordersTable.status, ["paid", "processing", "shipping", "arrived"]),
          ),
        );

      byCollection[collection] = { sold: Number(soldCount), max: maxQuantity };
    }

    res.json({ byCollection });
  } catch (err) {
    req.log.error({ err }, "Failed to get inventory");
    res.status(500).json({ error: "Failed to get inventory" });
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

// ── Comments ──────────────────────────────────────────────────────────────────

router.get("/presets/:id/comments", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const comments = await db
      .select()
      .from(presetCommentsTable)
      .where(eq(presetCommentsTable.presetId, id))
      .orderBy(desc(presetCommentsTable.createdAt))
      .limit(50);
    res.json(comments);
  } catch (err) {
    req.log.error({ err }, "Failed to list comments");
    res.status(500).json({ error: "Failed to list comments" });
  }
});

router.post("/presets/:id/comments", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { authorName, text } = req.body as { authorName?: string; text?: string };
    if (!text?.trim()) return res.status(400).json({ error: "Text required" });

    const [preset] = await db.select({ id: watchPresetsTable.id }).from(watchPresetsTable).where(eq(watchPresetsTable.id, id));
    if (!preset) return res.status(404).json({ error: "Preset not found" });

    const [comment] = await db
      .insert(presetCommentsTable)
      .values({
        presetId: id,
        authorName: authorName?.trim() || "Аноним",
        text: text.trim(),
      })
      .returning();

    res.status(201).json(comment);
  } catch (err) {
    req.log.error({ err }, "Failed to post comment");
    res.status(500).json({ error: "Failed to post comment" });
  }
});

export default router;
