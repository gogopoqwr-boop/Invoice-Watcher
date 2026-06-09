import { Router } from "express";
import { db, ordersTable, analyticsEventsTable } from "@workspace/db";
import { eq, count, sum, gte, sql } from "drizzle-orm";

const router = Router();

router.get("/analytics/summary", async (req, res) => {
  try {
    const [totalOrdersRow] = await db.select({ value: count() }).from(ordersTable);
    const [paidRow] = await db.select({ value: count() }).from(ordersTable)
      .where(sql`${ordersTable.status} IN ('processing', 'shipping', 'arrived')`);
    const [cancelledRow] = await db.select({ value: count() }).from(ordersTable)
      .where(eq(ordersTable.status, "cancelled"));
    const [revenueRow] = await db.select({ value: sum(ordersTable.totalStars) }).from(ordersTable)
      .where(sql`${ordersTable.status} IN ('processing', 'shipping', 'arrived')`);

    const [visitorsRow] = await db.select({ value: count() }).from(analyticsEventsTable)
      .where(eq(analyticsEventsTable.eventType, "page_visit"));
    const [checkoutsRow] = await db.select({ value: count() }).from(analyticsEventsTable)
      .where(eq(analyticsEventsTable.eventType, "checkout_start"));

    const totalOrders = Number(totalOrdersRow.value);
    const paidOrders = Number(paidRow.value);
    const cancelRequests = Number(cancelledRow.value);
    const totalRevenue = Number(revenueRow.value ?? 0);
    const uniqueVisitors = Number(visitorsRow.value);
    const checkoutStarts = Number(checkoutsRow.value);
    const conversionRate = checkoutStarts > 0 ? (paidOrders / checkoutStarts) * 100 : 0;

    res.json({
      totalRevenue,
      totalOrders,
      paidOrders,
      cancelRequests,
      uniqueVisitors,
      checkoutStarts,
      conversionRate: Math.round(conversionRate * 10) / 10,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get analytics summary");
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

router.get("/analytics/time-series", async (req, res) => {
  try {
    const metric = (req.query.metric as string) || "orders";
    const days = parseInt(req.query.days as string) || 30;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let rows: Array<{ date: string; value: number }> = [];

    if (metric === "orders" || metric === "revenue") {
      const data = await db
        .select({
          date: sql<string>`DATE(${ordersTable.createdAt})::text`,
          orders: count(),
          revenue: sum(ordersTable.totalStars),
        })
        .from(ordersTable)
        .where(gte(ordersTable.createdAt, cutoff))
        .groupBy(sql`DATE(${ordersTable.createdAt})`)
        .orderBy(sql`DATE(${ordersTable.createdAt})`);

      rows = data.map((r) => ({
        date: r.date,
        value: metric === "revenue" ? Number(r.revenue ?? 0) : Number(r.orders),
      }));
    } else {
      const eventType = metric === "visitors" ? "page_visit" : "checkout_start";
      const data = await db
        .select({
          date: sql<string>`DATE(${analyticsEventsTable.createdAt})::text`,
          cnt: count(),
        })
        .from(analyticsEventsTable)
        .where(
          sql`${analyticsEventsTable.eventType} = ${eventType} AND ${analyticsEventsTable.createdAt} >= ${cutoff}`
        )
        .groupBy(sql`DATE(${analyticsEventsTable.createdAt})`)
        .orderBy(sql`DATE(${analyticsEventsTable.createdAt})`);

      rows = data.map((r) => ({ date: r.date, value: Number(r.cnt) }));
    }

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get time series");
    res.status(500).json({ error: "Failed to get time series" });
  }
});

export default router;
