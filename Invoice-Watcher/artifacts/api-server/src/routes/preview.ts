import { Router } from "express";
import { db, watchConfigsTable, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateWatchBoxSVG } from "../lib/watchBoxSvg.js";

const router = Router();

router.get("/watch-preview/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send("Invalid id");

    let config: any = null;

    const [cfg] = await db.select().from(watchConfigsTable).where(eq(watchConfigsTable.id, id));
    if (cfg) {
      config = cfg;
    } else {
      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
      if (order?.configId) {
        const [c] = await db.select().from(watchConfigsTable).where(eq(watchConfigsTable.id, order.configId));
        if (c) config = c;
      }
    }

    const svg = generateWatchBoxSVG(config ?? {}, 600, 500);

    let sharp: any;
    try {
      sharp = (await import("sharp")).default;
    } catch {
      res.setHeader("Content-Type", "image/svg+xml");
      return res.send(svg);
    }

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(png);
  } catch (err) {
    req.log.error({ err }, "watch-preview error");
    res.status(500).send("Error");
  }
});

export default router;
