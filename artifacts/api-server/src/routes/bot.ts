import { Router } from "express";
import { db, ordersTable, watchConfigsTable } from "@workspace/db";
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

  return "";
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

async function sendWatchInvoice(chatId: number | string, orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));

  if (!order) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "Заказ не найден. Пожалуйста, создайте новый заказ на сайте.",
    });
    return;
  }

  if (order.status === "paid") {
    const orderUrl = buildOrderReturnUrl(orderId);
    const msg: Record<string, unknown> = {
      chat_id: chatId,
      text: `Заказ #${orderId} уже оплачен. Спасибо! ✅`,
    };
    if (orderUrl) {
      msg.reply_markup = {
        inline_keyboard: [[{ text: "Посмотреть заказ на сайте", url: orderUrl }]],
      };
    }
    await callTelegram("sendMessage", msg);
    return;
  }

  if (order.status === "cancelled") {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: `Заказ #${orderId} был отменён. Создайте новый заказ на сайте.`,
    });
    return;
  }

  const [config] = order.configId
    ? await db.select().from(watchConfigsTable).where(eq(watchConfigsTable.id, order.configId))
    : [null];

  const configDesc = config
    ? [
        `Корпус: ${config.watchfaceGeometry ?? "—"} (${config.watchfaceMaterial ?? "—"})`,
        `Ремешок: ${config.braceletMaterial ?? "—"}`,
        config.watchfaceText ? `Надпись: ${config.watchfaceText}` : null,
        config.serialNumber ? `Серийный №: ${config.serialNumber}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "Кастомные часы";

  await callTelegram("sendInvoice", {
    chat_id: chatId,
    title: `Заказ #${orderId} — Часы На Утрах`,
    description: configDesc,
    payload: JSON.stringify({ orderId }),
    currency: "XTR",
    prices: [{ label: "Итого", amount: order.totalStars }],
  });
}

router.post("/bot/webhook", async (req, res) => {
  res.json({ ok: true });

  try {
    const update = req.body;
    req.log.info({ updateId: update.update_id, keys: Object.keys(update) }, "Telegram update received");

    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text: string = update.message.text;

      if (text.startsWith("/start")) {
        const parts = text.split(" ");
        const param = parts[1]?.trim();

        if (param?.startsWith("pay_")) {
          const orderId = parseInt(param.replace("pay_", ""), 10);
          if (!isNaN(orderId)) {
            try {
              await sendWatchInvoice(chatId, orderId);
            } catch (err) {
              req.log.error({ err, orderId }, "Failed to send invoice");
              await callTelegram("sendMessage", {
                chat_id: chatId,
                text: "Не удалось загрузить заказ. Попробуйте ещё раз.",
              });
            }
          }
        } else {
          await callTelegram("sendMessage", {
            chat_id: chatId,
            text: "Привет! 👋 Создайте свои уникальные часы на сайте и оплатите звёздами Telegram.",
          });
        }
      }
    }

    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      req.log.info({ pcqId: pcq.id, payload: pcq.invoice_payload }, "Pre-checkout query");
      await callTelegram("answerPreCheckoutQuery", {
        pre_checkout_query_id: pcq.id,
        ok: true,
      });
    }

    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      req.log.info({ payment }, "Successful payment received");

      let payload: { orderId?: number } = {};
      try {
        payload = JSON.parse(payment.invoice_payload ?? "{}");
      } catch (e) {
        req.log.error({ raw: payment.invoice_payload, err: e }, "Failed to parse invoice_payload");
      }

      const orderId = Number(payload.orderId);
      const telegramId = String(update.message.from?.id ?? "");
      const telegramUsername = update.message.from?.username ?? null;
      const chargeId: string = payment.telegram_payment_charge_id ?? "";

      if (!orderId) {
        req.log.error({ payload }, "successful_payment: orderId missing from payload");
        return;
      }

      const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));

      if (existing?.status === "paid") {
        req.log.warn({ orderId, chargeId }, "Duplicate payment for already-paid order");
        await callTelegram("sendMessage", {
          chat_id: update.message.chat.id,
          text: `Заказ #${orderId} уже подтверждён. Если вы были списаны повторно — обратитесь в поддержку. ID транзакции: ${chargeId}`,
        });
        return;
      }

      await db.update(ordersTable)
        .set({
          status: "paid",
          telegramId,
          telegramUsername: telegramUsername ?? undefined,
          telegramPaymentChargeId: chargeId,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));

      req.log.info({ orderId, chargeId, telegramId }, "Order marked as paid");

      const orderUrl = buildOrderReturnUrl(orderId);
      const successMsg: Record<string, unknown> = {
        chat_id: update.message.chat.id,
        text: `✅ Оплата получена! Заказ #${orderId} подтверждён.\n\nСпасибо за покупку — ваши часы уже в производстве! ⌚`,
      };
      if (orderUrl) {
        successMsg.reply_markup = {
          inline_keyboard: [[{ text: "Посмотреть заказ на сайте", url: orderUrl }]],
        };
      }
      await callTelegram("sendMessage", successMsg);
    }

  } catch (err) {
    req.log.error({ err }, "Bot webhook error");
  }
});

router.post("/bot/register-webhook", async (req, res) => {
  try {
    const webhookUrl = req.body.url as string;
    if (!webhookUrl) {
      return res.status(400).json({ error: "url is required" });
    }
    const result = await callTelegram("setWebhook", {
      url: `${webhookUrl}/api/bot/webhook`,
      allowed_updates: ["message", "pre_checkout_query"],
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to register webhook");
    res.status(500).json({ error: "Failed to register webhook" });
  }
});

router.get("/bot/webhook-info", async (_req, res) => {
  try {
    const result = await callTelegram("getWebhookInfo", {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to get webhook info" });
  }
});

export default router;
