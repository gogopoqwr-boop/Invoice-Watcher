import { Router } from "express";
import { db, ordersTable, watchConfigsTable, analyticsEventsTable, botUsersTable } from "@workspace/db";
import { eq, sql, gte, count, sum } from "drizzle-orm";
import { buildBreakdown, formatReceiptText } from "../lib/receipt.js";

const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_ID ?? "";

// ── Premium emoji helpers ─────────────────────────────────────────────────────
// IDs are document IDs from Telegram's animated custom emoji packs.
// Fallback Unicode emoji are shown to users where the custom emoji isn't available.

const PE: Record<string, [string, string]> = {
  star:   ["5368324170671202286", "⭐"],
  gem:    ["5379748750804112376", "💎"],
  check:  ["5368324170671202290", "✅"],
  cross:  ["5368324170671202313", "❌"],
  warn:   ["5368324170671202300", "⚠️"],
  box:    ["5383691314632804351", "📦"],
  money:  ["5373638089583495210", "💰"],
  wings:  ["5373638089583495215", "💸"],
  chart:  ["5373638089583495220", "📊"],
  cart:   ["5373638089583495225", "🛒"],
  clock:  ["5373638089583495230", "⏳"],
  watch:  ["5373638089583495235", "⌚"],
  person: ["5391210470549891502", "👤"],
  truck:  ["5373638089583495250", "🚚"],
  clip:   ["5373638089583495255", "📋"],
  mail:   ["5373638089583495260", "✉️"],
  pin:    ["5373638089583495265", "📍"],
  shop:   ["5373638089583495270", "🛍"],
  hi:     ["5373638089583495275", "👋"],
  cog:    ["5373638089583495280", "⚙️"],
  up:     ["5373638089583495285", "📈"],
  fire:   ["5373638089583495290", "🔥"],
  hammer: ["5373638089583495295", "🔨"],
  link:   ["5373638089583495300", "🔗"],
  gift:   ["5373638089583495305", "🎁"],
  card:   ["5373638089583495310", "💳"],
  speech: ["5373638089583495315", "💬"],
  sparkle:["5373638089583495320", "✨"],
  rocket: ["5373638089583495325", "🚀"],
  bell:   ["5373638089583495330", "🔔"],
};

/** Render a premium animated emoji with Unicode fallback. */
function pe(key: keyof typeof PE): string {
  const [id, fb] = PE[key];
  return `<tg-emoji emoji-id="${id}">${fb}</tg-emoji>`;
}

/** Escape user-supplied content for Telegram HTML parse mode. */
function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── URL helpers ───────────────────────────────────────────────────────────────

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

// ── Telegram API ──────────────────────────────────────────────────────────────

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
    const username = order.telegramUsername
      ? `@${esc(order.telegramUsername)}`
      : `ID: ${esc(order.telegramId ?? "?")}`;

    let configLine = "Кастомные часы";
    if (config) {
      const parts: string[] = [];
      if ((config as any).presetName) parts.push(esc((config as any).presetName));
      if (config.watchfaceMaterial) parts.push(config.watchfaceMaterial === "metal" ? "Металл" : "Пластик");
      if (config.braceletMaterial) parts.push(esc(config.braceletMaterial));
      if (config.boxType && config.boxType !== "standard") parts.push(esc(config.boxType));
      if (config.watchfaceText) parts.push(`«${esc(config.watchfaceText)}»`);
      if (parts.length) configLine = parts.join(" · ");
    }

    const text = [
      `${pe("money")} <b>Новая оплата!</b>`,
      ``,
      `${pe("clip")} Заказ #${orderId}`,
      `${pe("person")} ${username}`,
      `${pe("star")} ${order.totalStars} звёзд`,
      `${pe("watch")} ${configLine}`,
      ...(order.deliveryEmail ? [`${pe("mail")} ${esc(order.deliveryEmail)}`] : []),
      ...(order.deliveryAddress ? [`${pe("pin")} ${esc(order.deliveryAddress)}`] : []),
    ].join("\n");

    await callTelegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: "💸 Вернуть звёзды", callback_data: `refund_ask:${orderId}` },
          { text: "🔗 Открыть заказ", url: buildOrderReturnUrl(orderId) ?? "https://t.me" },
        ]],
      },
    });
  } catch {
    // best-effort
  }
}

export async function sendAdminCancelRequestNotification(orderId: number, order: any) {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;
  try {
    const username = order.telegramUsername
      ? `@${esc(order.telegramUsername)}`
      : order.telegramId ? `ID: ${esc(order.telegramId)}` : "неизвестен";
    const hasPaid = !!order.telegramPaymentChargeId;

    const lines = [
      `${pe("warn")} <b>Запрос отмены заказа #${orderId}</b>`,
      ``,
      `${pe("person")} ${username}`,
      `${pe("star")} ${order.totalStars} звёзд`,
      hasPaid
        ? `${pe("card")} Оплачен — потребуется возврат`
        : `${pe("clock")} Ещё не оплачен`,
    ];
    if (order.cancelComment) lines.push(`${pe("speech")} Причина: ${esc(order.cancelComment)}`);
    if (order.deliveryEmail) lines.push(`${pe("mail")} ${esc(order.deliveryEmail)}`);

    const orderUrl = (() => {
      const domains = process.env.REPLIT_DOMAINS ?? "";
      const d = domains.split(",")[0]?.trim();
      return d ? `https://${d}/admin` : null;
    })();

    await callTelegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text: lines.join("\n"),
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          hasPaid
            ? { text: "💸 Одобрить и вернуть ⭐", callback_data: `refund_ask:${orderId}` }
            : { text: "✅ Одобрить отмену", callback_data: `cancel_approve:${orderId}` },
          ...(orderUrl ? [{ text: "🔗 Открыть Admin", url: orderUrl }] : []),
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
    const [checkoutsHour] = await db.select({ value: count() }).from(analyticsEventsTable)
      .where(sql`${analyticsEventsTable.eventType} = 'checkout_start' AND ${analyticsEventsTable.createdAt} >= ${oneHourAgo}`);
    const [paidCountHour] = await db.select({ value: count() }).from(ordersTable)
      .where(sql`${ordersTable.status} IN ('paid','processing','shipping','arrived') AND ${ordersTable.updatedAt} >= ${oneHourAgo}`);
    const [paidStarsHour] = await db.select({ value: sum(ordersTable.totalStars) }).from(ordersTable)
      .where(sql`${ordersTable.status} IN ('paid','processing','shipping','arrived') AND ${ordersTable.updatedAt} >= ${oneHourAgo}`);
    const [cancelRequestsHour] = await db.select({ value: count() }).from(ordersTable)
      .where(sql`${ordersTable.status} = 'cancel_requested' AND ${ordersTable.updatedAt} >= ${oneHourAgo}`);

    const [totalOrders] = await db.select({ value: count() }).from(ordersTable);
    const [totalPaid] = await db.select({ value: count() }).from(ordersTable)
      .where(sql`${ordersTable.status} IN ('paid','processing','shipping','arrived')`);
    const [totalRevenue] = await db.select({ value: sum(ordersTable.totalStars) }).from(ordersTable)
      .where(sql`${ordersTable.status} IN ('paid','processing','shipping','arrived')`);
    const [pendingPayment] = await db.select({ value: count() }).from(ordersTable)
      .where(eq(ordersTable.status, "payment_pending"));
    const [cancelRequests] = await db.select({ value: count() }).from(ordersTable)
      .where(eq(ordersTable.status, "cancel_requested"));

    const checkoutsN = Number(checkoutsHour.value);
    const paidN = Number(paidCountHour.value);
    const visitorsN = Number(visitorsHour.value);
    const notPaidN = Math.max(0, checkoutsN - paidN);
    const convRate = checkoutsN > 0 ? Math.round((paidN / checkoutsN) * 100) : 0;

    const bar = (n: number, total: number, len = 8) => {
      if (total === 0) return "░".repeat(len);
      const filled = Math.round((n / total) * len);
      return "█".repeat(filled) + "░".repeat(len - filled);
    };

    const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

    const text = [
      `${pe("chart")} <b>Статистика — ${now} МСК</b>`,
      ``,
      `<b>Воронка за час:</b>`,
      `${pe("person")} Посетили сайт:        <b>${visitorsN}</b>`,
      `${pe("cart")} Дошли до оплаты:      <b>${checkoutsN}</b>  ${bar(checkoutsN, visitorsN)}`,
      `${pe("cross")} Не оплатили:          <b>${notPaidN}</b>  ${bar(notPaidN, checkoutsN)}`,
      `${pe("check")} Оплатили:             <b>${paidN}</b>  ${bar(paidN, checkoutsN)}`,
      `${pe("star")} Собрано звёзд:        <b>${Number(paidStarsHour.value ?? 0)} ⭐</b>`,
      `${pe("up")} Конверсия:            <b>${convRate}%</b>`,
      ...(Number(cancelRequestsHour.value) > 0 ? [`${pe("warn")} Запросов отмены:      <b>${cancelRequestsHour.value}</b>`] : []),
      ``,
      `<b>Всего:</b>`,
      `${pe("box")} Заказов: <b>${totalOrders.value}</b>  ${pe("check")} Оплачено: <b>${totalPaid.value}</b>  ${pe("clock")} Ждут: <b>${pendingPayment.value}</b>`,
      ...(Number(cancelRequests.value) > 0 ? [`${pe("warn")} На отмене: <b>${cancelRequests.value}</b>`] : []),
      `${pe("gem")} Выручка: <b>${Number(totalRevenue.value ?? 0)} ⭐</b>`,
    ].join("\n");

    await callTelegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text,
      parse_mode: "HTML",
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
  const username = order.telegramUsername
    ? `@${esc(order.telegramUsername)}`
    : `ID: ${esc(order.telegramId ?? "?")}`;

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
    text: `${pe("warn")} Вернуть <b>${order.totalStars} ⭐</b> пользователю <b>${username}</b> за заказ <b>#${orderId}</b>?\n\nЭто действие нельзя отменить.`,
    parse_mode: "HTML",
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
        text: `${pe("check")} Возврат <b>${order.totalStars} ⭐</b> по заказу <b>#${orderId}</b> выполнен.`,
        parse_mode: "HTML",
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
    text: `${pe("cross")} Возврат отменён.`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] },
  });
}

// ── Invoice sender ────────────────────────────────────────────────────────────

async function sendWatchInvoice(chatId: number | string, orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));

  if (!order) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: `${pe("warn")} Заказ не найден. Пожалуйста, создайте новый заказ на сайте.`,
      parse_mode: "HTML",
    });
    return;
  }

  if (order.status === "paid") {
    const orderUrl = buildOrderReturnUrl(orderId);
    const msg: Record<string, unknown> = {
      chat_id: chatId,
      text: `${pe("check")} Заказ #${orderId} уже оплачен. Спасибо! Ваши часы уже в работе ${pe("watch")}`,
      parse_mode: "HTML",
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
      text: `${pe("cross")} Заказ #${orderId} был отменён. Создайте новый заказ на сайте.`,
      parse_mode: "HTML",
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
    await callTelegram("sendAnimation", { chat_id: chatId, animation: animUrl, caption });
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
    `${pe("check")} <b>Оплата подтверждена!</b>`,
    ``,
    `${pe("clip")} <b>Заказ #${orderId}</b>`,
    ``,
    `${pe("watch")} <b>Состав заказа:</b>`,
    esc(configSection),
    ``,
    `${pe("hammer")} Ваши часы уже в производстве! Мы уведомим вас об отправке.`,
  ].join("\n");

  const msg: Record<string, unknown> = {
    chat_id: chatId,
    text: receiptLines,
    parse_mode: "HTML",
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
      text = `${pe("cog")} <b>Заказ #${orderId} — В производстве</b>\n\nВаши часы начали изготавливаться! Мы сообщим, когда они будут отправлены.`;
      break;
    case "shipping":
      text = trackingCode
        ? `${pe("truck")} <b>Заказ #${orderId} отправлен!</b>\n\nТрек-номер: <code>${esc(trackingCode)}</code>\n\nОтслеживайте посылку по трек-номеру.`
        : `${pe("truck")} <b>Заказ #${orderId} отправлен!</b>\n\nВаши часы в пути! Ожидайте доставку.`;
      break;
    case "arrived":
      text = `${pe("box")} <b>Заказ #${orderId} доставлен!</b>\n\nВаши часы ждут вас. Наслаждайтесь! ${pe("watch")} ${pe("sparkle")}`;
      break;
    case "cancelled":
      text = `${pe("cross")} <b>Заказ #${orderId} отменён.</b>\n\nЕсли была оплата — возврат звёзд будет выполнен в ближайшее время.`;
      break;
    default:
      return;
  }

  const msg: Record<string, unknown> = {
    chat_id: telegramId,
    text,
    parse_mode: "HTML",
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
      } else if (data.startsWith("cancel_approve:")) {
        const orderId = parseInt(data.split(":")[1], 10);
        const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
        if (!order) {
          await callTelegram("answerCallbackQuery", { callback_query_id: cq.id, text: "Заказ не найден", show_alert: true });
        } else {
          await db.update(ordersTable)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(ordersTable.id, orderId));
          await callTelegram("answerCallbackQuery", { callback_query_id: cq.id, text: "✅ Заказ отменён", show_alert: true });
          await callTelegram("editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: `${pe("check")} Заказ <b>#${orderId}</b> отменён.`,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [] },
          });
          if (order.telegramId) {
            sendStatusNotification(order.telegramId, orderId, "cancelled").catch(() => {});
          }
        }
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

        // Track bot user (upsert)
        const from = update.message.from;
        if (from?.id) {
          const fromWebsite = !!(param?.startsWith("pay_") || param === "orders");
          db.insert(botUsersTable).values({
            telegramId: String(from.id),
            username: from.username ?? null,
            firstName: from.first_name ?? null,
            lastName: from.last_name ?? null,
            fromWebsite,
            lastSeenAt: new Date(),
          }).onConflictDoUpdate({
            target: botUsersTable.telegramId,
            set: {
              username: from.username ?? null,
              firstName: from.first_name ?? null,
              lastName: from.last_name ?? null,
              lastSeenAt: new Date(),
            },
          }).catch(() => {});
        }

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
            text: `${pe("box")} Откройте список ваших заказов на сайте:`,
            parse_mode: "HTML",
          };
          if (orderUrl) msg.reply_markup = { inline_keyboard: [[{ text: "Мои заказы", url: orderUrl }]] };
          await callTelegram("sendMessage", msg);
        } else {
          const siteUrl = getWebsiteBaseUrl();
          const startMsg: Record<string, unknown> = {
            chat_id: chatId,
            text: `${pe("watch")} <b>Привет! Это бот Чеблячас.</b>\n\nЗдесь вы можете оплатить заказ часов звёздами Telegram.\n\nСоздайте свои уникальные часы на сайте!`,
            parse_mode: "HTML",
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
          text: `${pe("warn")} <b>Заказ #${orderId}</b> уже был оплачен ранее.\n\nID транзакции: <code>${esc(chargeId)}</code>\n\nЭта транзакция записана и будет проверена. Если вы были списаны повторно — обратитесь в поддержку с этим ID.`,
          parse_mode: "HTML",
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

      try {
        await sendPaymentReceipt(chatId, orderId, updatedOrder ?? existing, config ?? null);
      } catch (err) {
        req.log.error({ err, orderId }, "Failed to send payment receipt — continuing");
      }

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
