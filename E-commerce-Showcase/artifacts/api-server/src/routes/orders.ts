import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, cartItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListOrdersQueryParams, GetOrderParams, RefundOrderParams, SimulatePaymentBody } from "@workspace/api-zod";
import crypto from "crypto";

const router = Router();

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

async function enrichOrder(order: typeof ordersTable.$inferSelect) {
  const items = await db.select().from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  const enrichedItems = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(productsTable)
      .where(eq(productsTable.id, item.productId));
    return { ...item, product };
  }));

  return { ...order, createdAt: order.createdAt.toISOString(), items: enrichedItems };
}

router.get("/orders", async (req, res) => {
  try {
    const parsed = ListOrdersQueryParams.safeParse(req.query);
    const sessionId = parsed.success ? parsed.data.sessionId : undefined;

    let orders;
    if (sessionId) {
      orders = await db.select().from(ordersTable)
        .where(eq(ordersTable.sessionId, sessionId))
        .orderBy(ordersTable.createdAt);
    } else {
      orders = await db.select().from(ordersTable).orderBy(ordersTable.createdAt);
    }

    const enriched = await Promise.all(orders.map(enrichOrder));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Must be before /orders/:id
router.post("/orders/simulate-payment", async (req, res) => {
  try {
    const parsed = SimulatePaymentBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "sessionId required" });
    const { sessionId } = parsed.data;

    // Pick a random product to put in the simulated order
    const products = await db.select().from(productsTable).limit(3);
    if (products.length === 0) return res.status(400).json({ error: "No products found" });

    const product = products[Math.floor(Math.random() * products.length)];
    const totalStars = product.priceStars;

    // Create a fake paid order with a simulated charge ID
    const fakeChargeId = `simulated_${crypto.randomBytes(8).toString("hex")}`;
    const token = crypto.randomBytes(16).toString("hex");

    const [order] = await db.insert(ordersTable).values({
      sessionId,
      status: "paid",
      totalStars,
      cartToken: token,
      telegramPaymentChargeId: fakeChargeId,
    }).returning();

    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: product.id,
      quantity: 1,
      selectedColor: product.selectedColor,
      priceStars: product.priceStars,
    });

    res.status(201).json(await enrichOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to simulate payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const parsed = GetOrderParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid id" });
    const [order] = await db.select().from(ordersTable)
      .where(eq(ordersTable.id, parsed.data.id));
    if (!order) return res.status(404).json({ error: "Not found" });
    res.json(await enrichOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders/:id/refund", async (req, res) => {
  try {
    const parsed = RefundOrderParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

    const [order] = await db.select().from(ordersTable)
      .where(eq(ordersTable.id, parsed.data.id));

    if (!order) return res.status(404).json({ error: "Order not found" });

    // Allow refunding "paid" orders normally, or re-issuing Telegram refund for already-DB-refunded orders
    // that may not have had Stars returned (e.g. charge ID was missing at refund time)
    if (order.status !== "paid" && order.status !== "refunded") {
      return res.status(400).json({ error: `Cannot refund order with status "${order.status}"` });
    }

    const isSimulated = order.telegramPaymentChargeId?.startsWith("simulated_");
    let telegramRefundResult: { ok: boolean; description?: string } = { ok: true };
    let telegramRefunded = false;

    if (order.telegramUserId && order.telegramPaymentChargeId && !isSimulated) {
      telegramRefundResult = await callTelegram("refundStarPayment", {
        user_id: Number(order.telegramUserId),
        telegram_payment_charge_id: order.telegramPaymentChargeId,
      });

      if (!telegramRefundResult.ok) {
        // Telegram returns error if already refunded — treat CHARGE_ALREADY_REFUNDED as ok
        const desc = (telegramRefundResult as { description?: string }).description ?? "";
        if (desc.includes("CHARGE_ALREADY_REFUNDED") || desc.includes("already refunded")) {
          req.log.info({ orderId: order.id }, "Telegram says already refunded — marking DB as refunded");
          telegramRefunded = true;
        } else {
          req.log.error({ telegramRefundResult }, "Telegram refund failed");
          return res.status(400).json({
            error: `Telegram refund failed: ${desc || "unknown error"}`,
          });
        }
      } else {
        telegramRefunded = true;
      }
    } else if (!order.telegramPaymentChargeId || isSimulated) {
      // No real charge ID — demo/simulated order, DB-only refund
      telegramRefunded = false;
    }

    // Mark as refunded in DB
    const [updated] = await db.update(ordersTable)
      .set({ status: "refunded" })
      .where(eq(ordersTable.id, order.id))
      .returning();

    req.log.info({ orderId: order.id, telegramRefunded }, "Order refunded");

    // Notify user via Telegram if we have their ID and actually returned Stars
    if (order.telegramUserId && telegramRefunded) {
      await callTelegram("sendMessage", {
        chat_id: order.telegramUserId,
        text: `Your order #${order.id} has been refunded. ${order.totalStars} Stars have been returned to your account.`,
      }).catch(() => {});
    }

    res.json({ ...(await enrichOrder(updated)), telegramRefunded });
  } catch (err) {
    req.log.error({ err }, "Failed to refund order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders/:id/cancel-request", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "paid") return res.status(400).json({ error: "Only paid orders can be cancelled" });

    const [updated] = await db.update(ordersTable)
      .set({ cancelRequested: true })
      .where(eq(ordersTable.id, id))
      .returning();

    req.log.info({ orderId: id }, "Cancel request submitted");
    res.json({ ...(await enrichOrder(updated)) });
  } catch (err) {
    req.log.error({ err }, "Cancel request failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

