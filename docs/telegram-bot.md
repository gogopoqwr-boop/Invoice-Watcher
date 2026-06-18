# Telegram Bot

← [Back to README](../README.md)

---

## Overview

The Telegram bot serves two roles:

1. **Payment gateway** — accepts Telegram Stars (XTR) invoices triggered by deep links from the website
2. **Notification channel** — sends buyers real-time status updates as their order progresses through the fulfilment pipeline

The bot uses **webhook mode** (not polling). On server startup, it auto-registers a webhook URL derived from the `REPLIT_DOMAINS` environment variable.

---

## Setup Checklist

- [ ] Create bot via **@BotFather** → `/newbot` → choose name and username
- [ ] Copy the token → set `TELEGRAM_BOT_TOKEN` secret
- [ ] Set `TELEGRAM_BOT_USERNAME` env var (username without `@`)
- [ ] Enable Stars payments: **@BotFather** → `/mybots` → your bot → **Payments** → **Telegram Stars**
- [ ] Deploy the API server to a public HTTPS URL (Replit handles this automatically)
- [ ] Verify webhook: `GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

---

## Webhook Registration

On every API server startup, `bot.ts` calls:

```ts
const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
const webhookUrl = `https://${domain}/api/bot/webhook`;
await bot.setWebhook(webhookUrl);
```

`REPLIT_DOMAINS` is automatically provided by the Replit runtime and contains the current deployment's public domain(s). If running locally without this variable, webhook registration is skipped and you can use polling mode for development (set `TELEGRAM_POLLING=true`).

To manually re-register the webhook (e.g. after a domain change):

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://your-domain.com/api/bot/webhook"
```

Or via the admin API (requires admin JWT):

```
POST /api/bot/register
Authorization: Bearer <jwt>
```

---

## Message Handlers

The bot handles four event types from Telegram:

### 1. `/start pay_<TOKEN>` — Payment Initiation

Triggered when a user opens the Telegram deep link from the payment page.

```
tg://resolve?domain=<BOT_USERNAME>&start=pay_<PAYMENT_TOKEN>
```

**Handler flow**:

```
1. Extract PAYMENT_TOKEN from the start parameter
2. Look up order by paymentToken in DB
3. If not found or already paid → send error message
4. If payment_pending → send invoice via sendInvoice()
```

**Invoice sent**:

```ts
await bot.sendInvoice(chatId, {
  title: 'Custom Watch – ЧЕБЛЯЧАС',
  description: `Order #${order.id} · ${watchConfig.watchfaceGeometry} case`,
  payload: String(order.id),      // passed back in successful_payment
  currency: 'XTR',                // Telegram Stars
  prices: [{ label: 'Watch', amount: order.totalStars }],
  photo_url: `${serverUrl}/api/watch-preview/${order.configId}`,
  photo_size: 512,
});
```

The `photo_url` is the server-rendered PNG preview of the configured watch, giving the user a visual confirmation of what they're buying.

### 2. `pre_checkout_query` — Payment Approval

Telegram sends this event before completing the payment. **The server must respond within 10 seconds** or the payment fails.

```ts
bot.on('pre_checkout_query', async (query) => {
  const orderId = parseInt(query.invoice_payload);
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order || order.status !== 'payment_pending') {
    // Reject — order no longer valid
    await bot.answerPreCheckoutQuery(query.id, false, {
      error_message: 'This order has expired or already been paid.',
    });
    return;
  }

  // Approve
  await bot.answerPreCheckoutQuery(query.id, true);
});
```

### 3. `successful_payment` — Payment Confirmed

Telegram delivers this as a message with a `successful_payment` field after the user pays.

```ts
bot.on('message', async (msg) => {
  if (!msg.successful_payment) return;

  const orderId = parseInt(msg.successful_payment.invoice_payload);
  const chargeId = msg.successful_payment.telegram_payment_charge_id;

  // Update DB
  await db.update(orders).set({
    status: 'paid',
    telegramPaymentChargeId: chargeId,
    telegramId: String(msg.from!.id),
    updatedAt: new Date(),
  }).where(eq(orders.id, orderId));

  // Send confirmation message + watch preview GIF
  await bot.sendMessage(msg.chat.id,
    `✅ Оплата получена!\nЗаказ #${orderId} в очереди на производство.\n\n` +
    `Следить за статусом: ${websiteUrl}/orders/${orderId}`
  );

  // Send animated watch preview
  const gifUrl = `${serverUrl}/api/watch-preview/${order.configId}/gif`;
  await bot.sendAnimation(msg.chat.id, gifUrl);
});
```

The `telegram_payment_charge_id` is stored on the order — it is required to issue refunds later.

### 4. General Messages

Any other message triggers a simple help reply:

```
Привет! 👋
Чтобы оформить заказ, перейди на сайт: <URL>
```

---

## Status Notifications

When an admin or courier updates an order status via the web panel, the server sends a notification to the buyer if their `telegramId` is known.

| Status transition | Message |
|-------------------|---------|
| → `processing` | 🔧 *Ваши часы собираются! Заказ #N* |
| → `shipping` | 🚚 *Заказ #N отправлен. Трек: `<code>`* |
| → `arrived` | 📦 *Заказ #N доставлен. Наслаждайтесь часами!* |
| → `cancelled` | ❌ *Заказ #N отменён. Stars возвращены на ваш счёт.* |

All messages include a link to the order detail page:
```
Подробнее: https://<domain>/orders/<id>
```

Notification code lives in `artifacts/api-server/src/routes/orders.ts`, called after the DB update succeeds.

---

## Stars Refunds

Stars can be refunded using the `refundStarPayment` Telegram Bot API method. The server calls this automatically when an order is cancelled:

```ts
async function refundOrder(order: Order): Promise<void> {
  if (!order.telegramPaymentChargeId || !order.telegramId) {
    // Order was never paid via Telegram Stars — nothing to refund
    return;
  }

  await bot.refundStarPayment(
    parseInt(order.telegramId),
    order.telegramPaymentChargeId,
  );
  // Stars are returned to buyer's wallet immediately
}
```

**Important**: The `telegramPaymentChargeId` can only be used for one refund. Attempting to refund twice will result in a Telegram API error. The server updates `status = "cancelled"` only after the refund call succeeds — if the Telegram API returns an error, the cancellation is aborted and the admin sees a 502 error.

---

## Watch Preview Generation

When the bot confirms payment, it sends a visual preview of the configured watch:

```
GET /api/watch-preview/:configId       → PNG (512×512)
GET /api/watch-preview/:configId/gif   → Animated GIF (rotating watch)
```

**PNG flow**:
1. Load `watch_configs` row by ID
2. Render an SVG string from the config (same geometry as `WatchSVG.tsx` but server-side)
3. Pass the SVG buffer to `sharp` for rasterisation
4. Return `image/png` response

**GIF flow**:
1. Render 24 frames of the watch at different Y-rotation angles (0° to 360°)
2. Composite each frame with `sharp`
3. Encode as animated GIF using `gif-encoder-2`
4. Return `image/gif` response

GIF generation is CPU-intensive (~200–500ms). Results are not cached — add caching if bot traffic is high.

---

## Local Development Without a Public URL

The Telegram webhook requires a public HTTPS URL. Options for local development:

**Option 1 — Use Replit** (recommended)  
Run the API server on Replit and let `REPLIT_DOMAINS` auto-register the webhook. Connect your local frontend's Vite proxy to the Replit API server URL.

**Option 2 — ngrok tunnel**

```bash
ngrok http 8080
# Copy the https://xxxx.ngrok.io URL

curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://xxxx.ngrok.io/api/bot/webhook"
```

**Option 3 — Polling mode (no webhook)**

Set `TELEGRAM_POLLING=true` in your local `.env`. The bot will use long-polling instead of a webhook. Stars payments work the same way.

```ts
// bot.ts — development mode fallback
if (process.env.TELEGRAM_POLLING === 'true') {
  bot.startPolling();
} else {
  await bot.setWebhook(webhookUrl);
}
```

---

## Debugging

**Check webhook status**:
```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Look for `"last_error_message"` — if present, Telegram is having trouble reaching your server.

**Test the deep link manually**:
Open `https://t.me/<BOT_USERNAME>?start=pay_<TOKEN>` in a browser. If Telegram opens and you see the invoice, the bot is working correctly.

**Simulate a payment in test mode**:  
Telegram provides a `sendInvoice` test mode. Set `provider_token: ""` (empty string) to use test Stars that don't deduct from a real balance. Only available in certain regions — check Telegram Bot API docs for current status.

**Log all incoming updates**:
```ts
bot.on('message', (msg) => console.log('message:', JSON.stringify(msg)));
bot.on('pre_checkout_query', (q) => console.log('pre_checkout_query:', JSON.stringify(q)));
```

The API server uses `pino` structured logging. In development (`NODE_ENV=development`), logs are pretty-printed to stdout.
