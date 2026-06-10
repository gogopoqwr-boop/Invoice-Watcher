import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, productsTable } from "@workspace/db";
import { eq, avg, count } from "drizzle-orm";
import { CreateReviewBody, GetProductReviewsParams } from "@workspace/api-zod";

const router = Router();

router.get("/reviews/:productId", async (req, res) => {
  try {
    const parsed = GetProductReviewsParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid productId" });
    const reviews = await db.select().from(reviewsTable)
      .where(eq(reviewsTable.productId, parsed.data.productId))
      .orderBy(reviewsTable.createdAt);
    res.json(reviews.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get reviews");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reviews", async (req, res) => {
  try {
    const parsed = CreateReviewBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const { productId, author, rating, text, imageUrls } = parsed.data;

    const [review] = await db.insert(reviewsTable).values({
      productId,
      author,
      rating,
      text,
      imageUrls: imageUrls ?? [],
    }).returning();

    // Update product average rating and review count
    const stats = await db.select({
      avg: avg(reviewsTable.rating),
      cnt: count(),
    }).from(reviewsTable).where(eq(reviewsTable.productId, productId));

    if (stats[0]) {
      await db.update(productsTable)
        .set({
          averageRating: stats[0].avg ? Number(stats[0].avg) : null,
          reviewCount: Number(stats[0].cnt),
        })
        .where(eq(productsTable.id, productId));
    }

    res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create review");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
