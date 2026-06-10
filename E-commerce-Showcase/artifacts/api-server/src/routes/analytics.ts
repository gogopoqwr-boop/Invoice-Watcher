import { Router } from "express";
import { db } from "@workspace/db";
import { analyticsEventsTable, ordersTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const TrackEventBody = z.object({
  sessionId: z.string(),
  eventType: z.string(),
  path: z.string().optional(),
  productId: z.number().int().optional(),
  meta: z.record(z.unknown()).optional(),
});

router.post("/analytics/event", async (req, res) => {
  try {
    const parsed = TrackEventBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    await db.insert(analyticsEventsTable).values({
      sessionId: parsed.data.sessionId,
      eventType: parsed.data.eventType,
      path: parsed.data.path,
      productId: parsed.data.productId,
      meta: parsed.data.meta ?? {},
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Track event failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/stats", async (req, res) => {
  try {
    // Unique visitors (sessions)
    const visitorRows = await db
      .selectDistinct({ sessionId: analyticsEventsTable.sessionId })
      .from(analyticsEventsTable);
    const uniqueVisitors = visitorRows.length;

    // Total page views
    const pvRows = await db
      .select({ c: count() })
      .from(analyticsEventsTable)
      .where(eq(analyticsEventsTable.eventType, "page_view"));
    const pageViews = Number(pvRows[0]?.c ?? 0);

    // Checkout starts
    const checkoutRows = await db
      .select({ c: count() })
      .from(analyticsEventsTable)
      .where(eq(analyticsEventsTable.eventType, "checkout_start"));
    const checkoutStarts = Number(checkoutRows[0]?.c ?? 0);

    // Orders by status
    const allOrders = await db.select().from(ordersTable);
    const paidOrders = allOrders.filter(o => o.status === "paid");
    const revenue = paidOrders.reduce((s, o) => s + o.totalStars, 0);

    // Top product views
    const topProductsRaw = await db
      .select({
        productId: analyticsEventsTable.productId,
        views: count(),
      })
      .from(analyticsEventsTable)
      .where(eq(analyticsEventsTable.eventType, "product_view"))
      .groupBy(analyticsEventsTable.productId)
      .orderBy(desc(count()))
      .limit(5);

    // Events by day (last 7 days)
    const recentEvents = await db
      .select({
        day: sql<string>`DATE(${analyticsEventsTable.createdAt})`,
        c: count(),
      })
      .from(analyticsEventsTable)
      .groupBy(sql`DATE(${analyticsEventsTable.createdAt})`)
      .orderBy(sql`DATE(${analyticsEventsTable.createdAt})`)
      .limit(7);

    res.json({
      uniqueVisitors,
      pageViews,
      checkoutStarts,
      totalOrders: allOrders.length,
      paidOrders: paidOrders.length,
      cancelRequested: allOrders.filter(o => o.cancelRequested).length,
      revenue,
      conversionRate: checkoutStarts > 0 ? Math.round((paidOrders.length / checkoutStarts) * 100) : 0,
      topProducts: topProductsRaw,
      recentActivity: recentEvents,
    });
  } catch (err) {
    req.log.error({ err }, "Analytics stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
