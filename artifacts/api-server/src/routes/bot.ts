import { Router } from "express";
import { db, ordersTable, watchConfigsTable, analyticsEventsTable } from "@workspace/db";
import { eq, sql, gte, count, sum } from "drizzle-orm";
import { buildBreakdown, formatReceiptText } from "../lib/receipt.js";

const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_ID ?? "";

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
  return `${baseUrl}/orders/${orderId}`;
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

// ── Admin notifications ───────────────────────────────────────────────────────

export async function sendAdminPaymentNotification(orderId: number, order: any, config: any) {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;
  try {
    const username = order.telegramUsername ? `@${order.telegramUsername}` : `ID: ${order.telegramId ?? "?"}`;
    let configLine = "Кастомные часы";
    if (config) {
      const parts: string[] = [];
      if ((config as any).presetName) parts.push((config as any).presetName);
      if (config.watchfaceMaterial) parts.push(config.watchfaceMaterial === "metal" ? "Металл" : "Пластик");
      if (config.braceletMaterial) parts.push(config.braceletMaterial);
      if (config.boxType && config.boxType !== "standard") parts.push(`📦 ${config.boxType}`);
      if (config.watchfaceText) parts.push(`"${config.watchfaceText}"`);
      if (parts.length) configLine = parts.join(" · ");
    }

    const text = [
      `💰 *Новая оплата!*`,
      ``,
      `📋 Заказ #${orderId}`,
      `👤 ${username}`,
      `⭐ ${order.totalStars} звёзд`,
      `⌚ ${configLine}`,
      ...(order.deliveryEmail ? [`✉️ ${order.deliveryEmail}`] : []),
      ...(order.deliveryAddress ? [`📍 ${order.deliveryAddress}`] : []),
    ].join("\n");

    await callTelegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "💸 Вернуть звёзды", callback_data: `refund_ask:${orderId}` },
          { text: "🔗 Открыть заказ", url: buildOrderReturnUrl(orderId) ?? `https://t.me` },
        ]],
      },
    });
  } catch {
    // best-effort
  }
}

export async function sendHourlyStats() {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [visitorsHour] = await db.select({ value: count() }).from(analyticsEventsTable)
      .where(sql`${analyticsEventsTable.eventType} = 'page_visit' AND ${analyticsEventsTable.createdAt} >= ${oneHourAgo}`);

    const [ordersHour] = await db.select({ value: count() }).from(ordersTable)
      .where(gte(ordersTable.createdAt, oneHourAgo));

    const [paidHour] = await db.select({ value: sum(ordersTable.totalStars) }).from(ordersTable)
      .where(sql`${ordersTable.status} IN ('paid','processing','shipping','arrived') AND ${ordersTable.updatedAt} >= ${oneHourAgo}`);

    const [totalOrders] = await db.select({ value: count() }).from(ordersTable);
    const [totalPaid] = await db.select({ value: count() }).from(ordersTable)
      .where(sql`${ordersTable.status} IN ('paid','processing','shipping','arrived')`);
    const [totalRevenue] = await db.select({ value: sum(ordersTable.totalStars) }).from(ordersTable)
      .where(sql`${ordersTable.status} IN ('paid','processing','shipping','arrived')`);
    const [pendingPayment] = await db.select({ value: count() }).from(ordersTable)
      .where(eq(ordersTable.status, "payment_pending"));

    const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

    const text = [
      `📊 *Статистика — ${now} МСК*`,
      ``,
      `*За последний час:*`,
      `👥 Посещений: ${visitorsHour.value}`,
      `📦 Новых заказов: ${ordersHour.value}`,
      `💰 Оплачено звёзд: ${Number(paidHour.value ?? 0)} ⭐`,
      ``,
      `*Всего:*`,
      `📦 Заказов: ${totalOrders.value}`,
      `✅ Оплачено: ${totalPaid.value}`,
      `⏳ Ожидают оплаты: ${pendingPayment.value}`,
      `💎 Выручка: ${Number(totalRevenue.value ?? 0)} ⭐`,
    ].join("\n");

    await callTelegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text,
      parse_mode: "Markdown",
    });
  } catch {
    // best-effort
  }
}

// ── Refund helpers ────────────────────────────────────────────────────────────

async function handleRefundAsk(callbackQueryId: string, chatId: string | number, messageId: number, orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) {
    await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text: "Заказ не найден", show_alert: true });
    return;
  }
  if (!order.telegramPaymentChargeId) {
    await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text: "У этого заказа нет charge ID — возврат невозможен", show_alert: true });
    return;
  }
  const username = order.telegramUsername ? `@${order.telegramUsername}` : `ID: ${order.telegramId ?? "?"}`;
  await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId });
  await callTelegram("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [[
        { text: `✅ Да, вернуть ${order.totalStars} ⭐`, callback_data: `refund_yes:${orderId}` },
        { text: "❌ Отмена", callback_data: `refund_no:${orderId}` },
      ]],
    },
  });
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: `⚠️ Вернуть *${order.totalStars} ⭐* пользователю *${username}* за заказ *#${orderId}*?\n\nЭто действие нельзя отменить.`,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: `✅ Да, вернуть ${order.totalStars} ⭐`, callback_data: `refund_yes:${orderId}` },
        { text: "❌ Отмена", callback_data: `refund_no:${orderId}` },
      ]],
    },
  });
}

async function handleRefundYes(callbackQueryId: string, chatId: string | number, messageId: number, orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) {
    await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text: "Заказ не найден", show_alert: true });
    return;
  }
  if (!order.telegramPaymentChargeId || !order.telegramId) {
    await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text: "Нет данных для возврата", show_alert: true });
    return;
  }

  try {
    const result: any = await callTelegram("refundStarPayment", {
      user_id: Number(order.telegramId),
      telegram_payment_charge_id: order.telegramPaymentChargeId,
    });

    if (result?.ok) {
      await db.update(ordersTable)
        .set({ status: "cancelled", refundComment: "Возврат через бот-панель", updatedAt: new Date() })
        .where(eq(ordersTable.id, orderId));

      await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text: "✅ Возврат выполнен!", show_alert: true });
      await callTelegram("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: `✅ Возврат *${order.totalStars} ⭐* по заказу *#${orderId}* выполнен.`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [] },
      });
    } else {
      await callTelegram("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text: `Ошибка: ${result?.description ?? "неизвестная"}`,
        show_alert: true,
      });
    }
  } catch {
    await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text: "Ошибка при возврате", show_alert: true });
  }
}

async function handleRefundNo(callbackQueryId: string, chatId: string | number, messageId: number) {
  await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text: "Отменено" });
  await callTelegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: "❌ Возврат отменён.",
    reply_markup: { inline_keyboard: [] },
  });
}

// ── Invoice sender ────────────────────────────────────────────────────────────

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

  let description = "Кастомные часы";
  if (config) {
    const { breakdown } = buildBreakdown(config);
    const lines: string[] = [];
    if (config.watchfaceGeometry) lines.push(`Форма: ${config.watchfaceGeometry}`);
    if (config.watchfaceMaterial) lines.push(`Корпус: ${config.watchfaceMaterial}`);
    if (config.braceletMaterial) lines.push(`Ремешок: ${config.braceletMaterial}`);
    if (config.boxType && config.boxType !== "standard") lines.push(`Коробка: ${config.boxType}`);
    if (config.watchfaceText) lines.push(`Надпись: "${config.watchfaceText}"`);
    if (config.serialNumber) lines.push(`Серийный №: ${config.serialNumber}`);
    lines.push(`Итого: ${order.totalStars} ⭐ (из ${breakdown.length} позиций)`);
    description = lines.join(" · ");
    if (description.length > 255) description = description.slice(0, 252) + "…";
  }

  const result = await callTelegram("sendInvoice", {
    chat_id: chatId,
    title: `⌚ Заказ #${orderId} — Чеблячас`,
    description,
    payload: JSON.stringify({ orderId }),
    currency: "XTR",
    prices: [{ label: "Итого", amount: order.totalStars }],
  });

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

async function sendWatchPreviewAnimation(chatId: string | number, orderId: number, config: any) {
  const baseUrl = getWebsiteBaseUrl();
  if (!baseUrl || !config) return;

  const animUrl = `${baseUrl}/api/watch-animation/${orderId}`;
  try {
    const caption = config.name ? `⌚ ${config.name}` : "⌚ Ваши часы";
    await callTelegram("sendAnimation", {
      chat_id: chatId,
      animation: animUrl,
      caption,
    });
  } catch {
    try {
      await callTelegram("sendPhoto", {
        chat_id: chatId,
        photo: `${baseUrl}/api/watch-preview/${orderId}`,
        caption: config.name ? `⌚ ${config.name}` : "⌚ Ваши часы",
      });
    } catch {
      // best-effort
    }
  }
}

async function sendPaymentReceipt(chatId: string | number, orderId: number, order: any, config: any) {
  const orderUrl = buildOrderReturnUrl(orderId);

  await sendWatchPreviewAnimation(chatId, orderId, config);

  let configSection = "  Кастомные часы";
  if (config) {
    const { breakdown } = buildBreakdown(config);
    configSection = formatReceiptText(breakdown, order.totalStars);
    if (config.serialNumber) configSection += `\n  Серийный №: ${config.serialNumber}`;
  }

  const receiptLines = [
    `✅ *Оплата подтверждена!*`,
    ``,
    `📋 *Заказ #${orderId}*`,
    ``,
    `⌚ *Состав заказа:*`,
    configSection,
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
    // silent
  }
}

// ── Webhook ───────────────────────────────────────────────────────────────────

router.post("/bot/webhook", async (req, res) => {
  res.json({ ok: true });

  try {
    const update = req.body;
    req.log.info({ updateId: update.update_id, keys: Object.keys(update) }, "Telegram update received");

    // ── Inline button presses ────────────────────────────────────────────────
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;
      const data: string = cq.data ?? "";

      if (data.startsWith("refund_ask:")) {
        const orderId = parseInt(data.split(":")[1], 10);
        await handleRefundAsk(cq.id, chatId, messageId, orderId);
      } else if (data.startsWith("refund_yes:")) {
        const orderId = parseInt(data.split(":")[1], 10);
        await handleRefundYes(cq.id, chatId, messageId, orderId);
      } else if (data.startsWith("refund_no:")) {
        await handleRefundNo(cq.id, chatId, messageId);
      } else {
        await callTelegram("answerCallbackQuery", { callback_query_id: cq.id });
      }
      return;
    }

    // ── Text messages ────────────────────────────────────────────────────────
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text: string = update.message.text;

      if (text.startsWith("/start")) {
        const parts = text.split(" ");
        const param = parts[1]?.trim();

        if (param?.startsWith("pay_")) {
          const token = param.slice(4);
          let orderId: number | null = null;
          if (/^\d+$/.test(token)) {
            orderId = parseInt(token, 10);
          } else {
            const [found] = await db
              .select({ id: ordersTable.id })
              .from(ordersTable)
              .where(eq(ordersTable.paymentToken, token))
              .limit(1);
            orderId = found?.id ?? null;
          }
          if (orderId !== null) {
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

    // ── Pre-checkout ─────────────────────────────────────────────────────────
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      req.log.info({ pcqId: pcq.id, payload: pcq.invoice_payload }, "Pre-checkout query");
      await callTelegram("answerPreCheckoutQuery", {
        pre_checkout_query_id: pcq.id,
        ok: true,
      });
    }

    // ── Successful payment ───────────────────────────────────────────────────
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

      // Notify the buyer
      try {
        await sendPaymentReceipt(chatId, orderId, updatedOrder ?? existing, config ?? null);
      } catch (err) {
        req.log.error({ err, orderId }, "Failed to send payment receipt — continuing");
      }

      // Notify admin
      sendAdminPaymentNotification(orderId, updatedOrder ?? existing, config ?? null)
        .catch(() => {});
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
      allowed_updates: ["message", "pre_checkout_query", "callback_query"],
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
