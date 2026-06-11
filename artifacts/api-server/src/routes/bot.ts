import { Router } from "express";
import { db, ordersTable, watchConfigsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

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

async function deleteMessage(chatId: number | string, messageId: number) {
  try {
    await callTelegram("deleteMessage", { chat_id: chatId, message_id: messageId });
  } catch {
    // best-effort
  }
}

async function sendWatchInvoice(chatId: number | string, orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));

  if (!order) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "⚠️ Заказ не найден. Пожалуйста, создайте новый заказ на сайте.",
    });
    return;
  }

  if (order.status === "paid") {
    const orderUrl = buildOrderReturnUrl(orderId);
    const msg: Record<string, unknown> = {
      chat_id: chatId,
      text: `✅ Заказ #${orderId} уже оплачен. Спасибо! Ваши часы уже в работе ⌚`,
    };
    if (orderUrl) {
      msg.reply_markup = { inline_keyboard: [[{ text: "📦 Посмотреть заказ", url: orderUrl }]] };
    }
    await callTelegram("sendMessage", msg);
    return;
  }

  if (order.status === "cancelled") {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: `❌ Заказ #${orderId} был отменён. Создайте новый заказ на сайте.`,
    });
    return;
  }

  const [config] = order.configId
    ? await db.select().from(watchConfigsTable).where(eq(watchConfigsTable.id, order.configId))
    : [null];

  const configLines = config
    ? [
        config.watchfaceGeometry ? `• Форма: ${config.watchfaceGeometry}` : null,
        config.watchfaceMaterial ? `• Материал: ${config.watchfaceMaterial}` : null,
        config.braceletMaterial ? `• Ремешок: ${config.braceletMaterial}` : null,
        config.watchfaceText ? `• Надпись: "${config.watchfaceText}"` : null,
        config.serialNumber ? `• Серийный №: ${config.serialNumber}` : null,
      ].filter(Boolean).join("\n")
    : "Кастомные часы";

  const result = await callTelegram("sendInvoice", {
    chat_id: chatId,
    title: `⌚ Заказ #${orderId} — Чеблячас`,
    description: configLines,
    payload: JSON.stringify({ orderId }),
    currency: "XTR",
    prices: [{ label: "Итого", amount: order.totalStars }],
  });

  // Store invoice message_id so we can delete it after payment
  if (result?.result?.message_id) {
    try {
      await db.update(ordersTable)
        .set({ telegramInvoiceMessageId: result.result.message_id })
        .where(eq(ordersTable.id, orderId));
    } catch {
      // non-fatal
    }
  }
}

async function sendPaymentReceipt(chatId: string | number, orderId: number, order: any, config: any) {
  const orderUrl = buildOrderReturnUrl(orderId);

  const receiptLines = [
    `✅ *Оплата подтверждена!*`,
    ``,
    `📋 *Заказ #${orderId}*`,
    `💫 Стоимость: ${order.totalStars} звёзд`,
    ``,
    `⌚ *Конфигурация:*`,
    config ? [
      config.watchfaceGeometry ? `  Форма: ${config.watchfaceGeometry}` : null,
      config.watchfaceMaterial ? `  Материал: ${config.watchfaceMaterial}` : null,
      config.braceletMaterial ? `  Ремешок: ${config.braceletMaterial}` : null,
      config.watchfaceText ? `  Надпись: "${config.watchfaceText}"` : null,
      config.serialNumber ? `  Серийный №: ${config.serialNumber}` : null,
    ].filter(Boolean).join("\n") : "  Кастомные часы",
    ``,
    `🔨 Ваши часы уже в производстве! Мы уведомим вас об отправке.`,
  ].join("\n");

  const msg: Record<string, unknown> = {
    chat_id: chatId,
    text: receiptLines,
    parse_mode: "Markdown",
  };

  if (orderUrl) {
    msg.reply_markup = {
      inline_keyboard: [[{ text: "📦 Отслеживать заказ", url: orderUrl }]],
    };
  }

  await callTelegram("sendMessage", msg);
}

export async function sendStatusNotification(telegramId: string, orderId: number, status: string, trackingCode?: string) {
  if (!BOT_TOKEN || !telegramId) return;

  const orderUrl = buildOrderReturnUrl(orderId);
  let text = "";

  switch (status) {
    case "processing":
      text = `⚙️ *Заказ #${orderId} — В производстве*\n\nВаши часы начали изготавливаться! Мы сообщим, когда они будут отправлены.`;
      break;
    case "shipping":
      text = trackingCode
        ? `🚚 *Заказ #${orderId} отправлен!*\n\nТрек-номер: \`${trackingCode}\`\n\nОтслеживайте посылку по трек-номеру.`
        : `🚚 *Заказ #${orderId} отправлен!*\n\nВаши часы в пути! Ожидайте доставку.`;
      break;
    case "arrived":
      text = `📦 *Заказ #${orderId} доставлен!*\n\nВаши часы ждут вас. Наслаждайтесь! ⌚✨`;
      break;
    case "cancelled":
      text = `❌ *Заказ #${orderId} отменён.*\n\nЕсли была оплата — возврат звёзд будет выполнен в ближайшее время.`;
      break;
    default:
      return;
  }

  const msg: Record<string, unknown> = {
    chat_id: telegramId,
    text,
    parse_mode: "Markdown",
  };

  if (orderUrl && status !== "cancelled") {
    msg.reply_markup = {
      inline_keyboard: [[{ text: "📦 Посмотреть заказ", url: orderUrl }]],
    };
  }

  try {
    await callTelegram("sendMessage", msg);
  } catch {
    // silent — notifications are best-effort
  }
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
        } else if (param === "orders") {
          const orderUrl = buildOrderReturnUrl(0)?.replace("/orders?paid=true&orderId=0", "/orders");
          const msg: Record<string, unknown> = {
            chat_id: chatId,
            text: "📦 Откройте список ваших заказов на сайте:",
          };
          if (orderUrl) msg.reply_markup = { inline_keyboard: [[{ text: "Мои заказы", url: orderUrl }]] };
          await callTelegram("sendMessage", msg);
        } else {
          const siteUrl = getWebsiteBaseUrl();
          const startMsg: Record<string, unknown> = {
            chat_id: chatId,
            text: "⌚ *Привет! Это бот Чеблячас.*\n\nЗдесь вы можете оплатить заказ часов звёздами Telegram.\n\nСоздайте свои уникальные часы на сайте!",
            parse_mode: "Markdown",
          };
          if (siteUrl) {
            startMsg.reply_markup = {
              inline_keyboard: [[{ text: "🛍 Открыть конфигуратор", url: siteUrl }]],
            };
          }
          await callTelegram("sendMessage", startMsg);
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
      const chatId = update.message.chat.id;

      if (!orderId) {
        req.log.error({ payload }, "successful_payment: orderId missing from payload");
        return;
      }

      const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));

      if (existing?.status === "paid") {
        req.log.warn({ orderId, chargeId }, "Duplicate payment for already-paid order");

        // Record the duplicate charge ID for admin review
        const existingDuplicates = existing.duplicateChargeIds
          ? existing.duplicateChargeIds.split(",")
          : [];
        const newDuplicates = [...existingDuplicates, chargeId].join(",");
        await db.update(ordersTable)
          .set({ duplicateChargeIds: newDuplicates, updatedAt: new Date() })
          .where(eq(ordersTable.id, orderId));

        await callTelegram("sendMessage", {
          chat_id: chatId,
          text: `⚠️ *Заказ #${orderId}* уже был оплачен ранее.\n\nID транзакции: \`${chargeId}\`\n\nЭта транзакция записана и будет проверена. Если вы были списаны повторно — обратитесь в поддержку с этим ID.`,
          parse_mode: "Markdown",
        });
        return;
      }

      // Delete the invoice message now that it's been paid (prevents re-tapping)
      if (existing?.telegramInvoiceMessageId) {
        await deleteMessage(chatId, existing.telegramInvoiceMessageId);
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

      const [updatedOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
      const [config] = updatedOrder?.configId
        ? await db.select().from(watchConfigsTable).where(eq(watchConfigsTable.id, updatedOrder.configId))
        : [null];

      try {
        await sendPaymentReceipt(chatId, orderId, updatedOrder ?? existing, config ?? null);
      } catch (err) {
        req.log.error({ err, orderId }, "Failed to send payment receipt — continuing");
      }
    }

  } catch (err) {
    req.log.error({ err }, "Bot webhook error");
  }
});

router.post("/bot/register-webhook", async (req, res) => {
  try {
    const webhookUrl = req.body.url as string;
    if (!webhookUrl) return res.status(400).json({ error: "url is required" });
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
