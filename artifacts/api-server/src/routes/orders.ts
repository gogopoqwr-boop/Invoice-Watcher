import { Router } from "express";
import { db, ordersTable, watchConfigsTable } from "@workspace/db";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendStatusNotification } from "./bot.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function callTelegram(method: string, body: object) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const router = Router();

router.get("/orders", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions = status ? [eq(ordersTable.status, status)] : [];

    const orders = await db.select().from(ordersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db.select({ value: count() }).from(ordersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Enrich with config
    const enriched = await Promise.all(orders.map(async (o) => {
      const [config] = await db.select().from(watchConfigsTable).where(eq(watchConfigsTable.id, o.configId));
      return { ...o, config: config ?? null };
    }));

    res.json({ orders: enriched, total: Number(total) });
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "Failed to list orders" });
  }
});

router.get("/orders/my", async (req, res) => {
  try {
    const { sessionId, telegramId } = req.query as { sessionId?: string; telegramId?: string };
    if (!sessionId && !telegramId) return res.json([]);

    const conditions = [];
    if (sessionId) conditions.push(eq(ordersTable.sessionId, sessionId));
    if (telegramId) conditions.push(eq(ordersTable.telegramId, telegramId));

    const orders = await db.select().from(ordersTable)
      .where(conditions.length === 1 ? conditions[0] : sql`(${ordersTable.sessionId} = ${sessionId} OR ${ordersTable.telegramId} = ${telegramId})`)
      .orderBy(desc(ordersTable.createdAt));

    const enriched = await Promise.all(orders.map(async (o) => {
      const [config] = await db.select().from(watchConfigsTable).where(eq(watchConfigsTable.id, o.configId));
      return { ...o, config: config ?? null };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to get user orders");
    res.status(500).json({ error: "Failed to get user orders" });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) return res.status(404).json({ error: "Order not found" });
    const [config] = await db.select().from(watchConfigsTable).where(eq(watchConfigsTable.id, order.configId));
    res.json({ ...order, config: config ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ error: "Failed to get order" });
  }
});

router.post("/orders", async (req, res) => {
  try {
    const body = req.body;
    const paymentToken = randomBytes(16).toString("hex");
    const [order] = await db.insert(ordersTable).values({
      paymentToken,
      configId: body.configId,
      userEmail: body.userEmail ?? null,
      deliveryEmail: body.deliveryEmail ?? null,
      deliveryAddress: body.deliveryAddress ?? null,
      boxMessage: body.boxMessage ?? null,
      telegramId: body.telegramId ?? null,
      telegramUsername: body.telegramUsername ?? null,
      sessionId: body.sessionId ?? null,
      totalStars: body.totalStars,
      paymentTxId: body.paymentTxId ?? null,
      status: "payment_pending",
    }).returning();
    res.status(201).json(order);
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.patch("/orders/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { status, courierId } = req.body;

    // Auto-refund Stars when cancelling a paid order
    if (status === "cancelled") {
      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
      if (order?.telegramPaymentChargeId && order?.telegramId) {
        try {
          const refundResult = await callTelegram("refundStarPayment", {
            user_id: Number(order.telegramId),
            telegram_payment_charge_id: order.telegramPaymentChargeId,
          });
          req.log.info({ orderId: id, refundResult }, "Telegram Stars refund issued on cancel");
        } catch (telegramErr) {
          req.log.error({ telegramErr, orderId: id }, "Failed to refund Stars on cancel — continuing");
        }
      }
    }

    const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
    if (courierId !== undefined) updateData.courierId = courierId;
    const [updated] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Order not found" });
    res.json(updated);

    // Fire-and-forget Telegram status notification
    if (updated.telegramId && ["processing", "shipping", "arrived", "cancelled"].includes(status)) {
      sendStatusNotification(updated.telegramId, id, status)
        .catch(err => req.log.error({ err, orderId: id, status }, "Failed to send status notification"));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update order status");
    res.status(500).json({ error: "Failed to update order status" });
  }
});

router.post("/orders/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { cancelComment } = req.body;
    const [updated] = await db.update(ordersTable)
      .set({ status: "cancelled", cancelComment, updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Order not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

router.post("/orders/:id/refund", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { refundComment } = req.body;

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) return res.status(404).json({ error: "Order not found" });

    let telegramRefundResult: unknown = null;
    if (order.telegramPaymentChargeId && order.telegramId) {
      try {
        telegramRefundResult = await callTelegram("refundStarPayment", {
          user_id: Number(order.telegramId),
          telegram_payment_charge_id: order.telegramPaymentChargeId,
        });
        req.log.info({ orderId: id, telegramRefundResult }, "Telegram Stars refund issued");
      } catch (telegramErr) {
        req.log.error({ telegramErr, orderId: id }, "Failed to call refundStarPayment — continuing with DB update");
      }
    }

    const [updated] = await db.update(ordersTable)
      .set({ status: "cancelled", refundComment: refundComment ?? null, updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();

    res.json({ ...updated, telegramRefundResult });
  } catch (err) {
    req.log.error({ err }, "Failed to refund order");
    res.status(500).json({ error: "Failed to refund order" });
  }
});

export default router;
