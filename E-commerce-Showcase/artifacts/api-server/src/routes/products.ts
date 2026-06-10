import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { UpdateProductColorBody, UpdateProductColorParams, ListProductsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/products/summary", async (req, res) => {
  try {
    const all = await db.select().from(productsTable);
    const byCategory: Record<string, number> = { phones: 0, laptops: 0, headsets: 0, accessories: 0 };
    for (const p of all) {
      if (p.category in byCategory) byCategory[p.category]++;
    }
    res.json({ total: all.length, byCategory });
  } catch (err) {
    req.log.error({ err }, "Failed to get summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const parsed = ListProductsQueryParams.safeParse(req.query);
    const category = parsed.success ? parsed.data.category : undefined;
    const page = parsed.success && parsed.data.page ? Number(parsed.data.page) : 1;
    const limit = parsed.success && parsed.data.limit ? Number(parsed.data.limit) : 10;
    const offset = (page - 1) * limit;

    let query = db.select().from(productsTable);
    let countQuery = db.select({ count: count() }).from(productsTable);

    let products;
    let total: number;

    if (category) {
      products = await db.select().from(productsTable)
        .where(eq(productsTable.category, category))
        .limit(limit).offset(offset);
      const countResult = await db.select({ count: count() }).from(productsTable)
        .where(eq(productsTable.category, category));
      total = Number(countResult[0]?.count ?? 0);
    } else {
      products = await db.select().from(productsTable).limit(limit).offset(offset);
      const countResult = await db.select({ count: count() }).from(productsTable);
      total = Number(countResult[0]?.count ?? 0);
    }

    res.json({ products, total, page, limit });
  } catch (err) {
    req.log.error({ err }, "Failed to list products");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    if (!product) return res.status(404).json({ error: "Not found" });
    res.json(product);
  } catch (err) {
    req.log.error({ err }, "Failed to get product");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/products/:id/color", async (req, res) => {
  try {
    const params = UpdateProductColorParams.safeParse(req.params);
    const body = UpdateProductColorBody.safeParse(req.body);
    if (!params.success || !body.success) return res.status(400).json({ error: "Invalid input" });
    const id = params.data.id;
    const { color } = body.data;
    const [updated] = await db.update(productsTable)
      .set({ selectedColor: color })
      .where(eq(productsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update product color");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
