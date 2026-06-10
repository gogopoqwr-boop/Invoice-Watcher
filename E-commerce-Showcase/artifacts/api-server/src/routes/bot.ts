import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function getWebsiteBaseUrl() {
  const envUrl = process.env.WEBSITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  const domains = process.env.REPLIT_DOMAINS ?? "";
  const primaryDomain = domains.split(",")[0]?.trim();
  if (primaryDomain) return `https://${primaryDomain}`;

  // Fallback to the known Replit deployment URL for this project.
  return "https://e-commerce-showcase--gogopoqwr.replit.app";
}

function buildOrderReturnUrl(orderId: number) {
  const baseUrl = getWebsiteBaseUrl();
  if (!baseUrl) return undefined;
  return `${baseUrl}/orders?paid=true&orderId=${orderId}`;
}

async function callTelegram(method: string, body: object) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendCartInvoice(chatId: number | string, token: string) {
  const [order] = await db.select().from(ordersTable)
    .where(eq(ordersTable.cartToken, token));
  if (!order) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Cart not found or already paid. Please create a new cart from the shop.",
    });
    return;
  }

  if (order.status === "paid") {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: `Order #${order.id} is already paid. Thank you!`,
    });
    return;
  }

  if (order.status === "refunded") {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: `Order #${order.id} has been refunded. Please create a new cart if you'd like to order again.`,
    });
    return;
  }

  const items = await db.select().from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));
  const enrichedItems = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(productsTable)
      .where(eq(productsTable.id, item.productId));
    return { ...item, product };
  }));

  const description = enrichedItems
    .map(i => `${i.product?.name ?? "Item"} x${i.quantity} (${i.selectedColor}) — ${i.priceStars * i.quantity} Stars`)
    .join("\n");

  await callTelegram("sendInvoice", {
    chat_id: chatId,
    title: "Your Order",
    description: description || "Tech products from the shop",
    payload: JSON.stringify({ orderId: order.id, token }),
    currency: "XTR",
    prices: [{ label: "Total", amount: order.totalStars }],
  });
}

router.post("/bot/webhook", async (req, res) => {
  // Always respond 200 immediately so Telegram doesn't retry
  res.json({ ok: true });

  try {
    const update = req.body;
    req.log.info({ updateId: update.update_id, keys: Object.keys(update) }, "Telegram update received");

    // /start command with cart token
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text: string = update.message.text;

      if (text.startsWith("/start")) {
        const parts = text.split(" ");
        const token = parts[1]?.trim();
        if (token) {
          try {
            await sendCartInvoice(chatId, token);
          } catch (err) {
            req.log.error({ err, token }, "Failed to send cart invoice for /start command");
            await callTelegram("sendMessage", {
              chat_id: chatId,
              text: "Sorry, I couldn't start your order right now. Please try again later.",
            });
          }
        } else {
          await callTelegram("sendMessage", {
            chat_id: chatId,
            text: "Welcome to the shop! Browse products at our web store and use the checkout to pay with Stars.",
          });
        }
      }
    }

    // Pre-checkout query — must always answer OK for Stars
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      req.log.info({ pcqId: pcq.id, payload: pcq.invoice_payload }, "Pre-checkout query");
      await callTelegram("answerPreCheckoutQuery", {
        pre_checkout_query_id: pcq.id,
        ok: true,
      });
    }

    // Successful payment — mark order as paid
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      req.log.info({ payment }, "Successful payment received");

      let payload: { orderId?: number; token?: string } = {};
      try {
        payload = JSON.parse(payment.invoice_payload ?? "{}");
      } catch (e) {
        req.log.error({ raw: payment.invoice_payload, err: e }, "Failed to parse invoice_payload");
      }

      const orderId = Number(payload.orderId);
      const telegramUserId = String(update.message.from?.id ?? "");
      const chargeId: string = payment.telegram_payment_charge_id ?? "";

      if (!orderId) {
        req.log.error({ payload }, "successful_payment: orderId missing from payload");
        return;
      }

      if (!chargeId) {
        req.log.error({ orderId }, "successful_payment: telegram_payment_charge_id missing");
      }

      // Check if this order is already paid (duplicate payment guard)
      const [existing] = await db.select().from(ordersTable)
        .where(eq(ordersTable.id, orderId));

      if (existing?.status === "paid") {
        req.log.warn({ orderId, chargeId }, "Duplicate payment received for already-paid order");
        const orderUrl = buildOrderReturnUrl(orderId);
        const duplicateMessage: Record<string, unknown> = {
          chat_id: update.message.chat.id,
          text: `Order #${orderId} is already confirmed. If you were charged again, please contact support with charge ID: ${chargeId}`,
        };
        if (orderUrl) {
          duplicateMessage.reply_markup = {
            inline_keyboard: [[{ text: "View order on website", url: orderUrl }]],
          };
        }
        await callTelegram("sendMessage", duplicateMessage);
        return;
      }

      await db.update(ordersTable)
        .set({ status: "paid", telegramUserId, telegramPaymentChargeId: chargeId })
        .where(eq(ordersTable.id, orderId));

      req.log.info({ orderId, chargeId, telegramUserId }, "Order marked as paid");

      const orderUrl = buildOrderReturnUrl(orderId);
      const successMessage: Record<string, unknown> = {
        chat_id: update.message.chat.id,
        text: `Payment received! Order #${orderId} confirmed. Thank you for your purchase!`,
      };
      if (orderUrl) {
        successMessage.reply_markup = {
          inline_keyboard: [[{ text: "Return to website", url: orderUrl }]],
        };
      }

      await callTelegram("sendMessage", successMessage);
    }

  } catch (err) {
    req.log.error({ err }, "Bot webhook error");
  }
});

export default router;
