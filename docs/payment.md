# Payment System — Telegram Stars

← [Back to README](../README.md)

---

## Overview

Payments use **Telegram Stars (XTR)**, Telegram's native in-app currency. The flow is:

1. User configures a watch → selects a preset → proceeds to checkout
2. Frontend creates an order via `POST /api/orders` → gets back an `orderId` and `paymentToken`
3. Frontend redirects to `/payment/:orderId` — shows a QR code and a deep link
4. User opens the link in Telegram → bot sends a Stars invoice
5. User pays inside Telegram → Telegram calls the bot webhook with `successful_payment`
6. Server marks the order as `paid` and notifies the user via Telegram message

---

## Deep Link Format

```
tg://resolve?domain=<BOT_USERNAME>&start=pay_<PAYMENT_TOKEN>
```

Web fallback (shows in browser, opens Telegram app):

```
https://t.me/<BOT_USERNAME>?start=pay_<PAYMENT_TOKEN>
```

The `PAYMENT_TOKEN` is a 32-character hex string generated server-side at order creation. It encodes nothing — the server looks up the order by token.

---

## Step-by-Step Flow

### Step 1 — Order Creation

```
POST /api/orders
Body: { configId: number, totalStars: number }

Response: {
  id: number,
  paymentToken: string,   // 32-hex
  status: "payment_pending"
}
```

Server-side (`orders.ts`):
1. Validates `configId` exists in `watch_configs`
2. Generates `paymentToken = crypto.randomBytes(16).toString('hex')`
3. Inserts into `orders` with `status = payment_pending`
4. Returns the new order

### Step 2 — Payment Page

`/payment/:orderId` (`Payment.tsx`) shows:
- **QR code** encoding the `https://t.me/...?start=pay_<TOKEN>` URL (rendered with `qrcode.react`)
- **"Open in Telegram" button** using the `tg://` deep link
- **10-minute countdown** — if the order is still `payment_pending` after 10 minutes, the page shows a "Repeat Payment" button that creates a fresh order
- **Automatic polling** every 3 seconds while `status === payment_pending` — transitions to the order detail page on any status change

### Step 3 — Bot receives `/start pay_<TOKEN>`

The Telegram bot webhook handler (`bot.ts`) processes the incoming message:

```ts
if (text.startsWith('/start pay_')) {
  const token = text.replace('/start pay_', '');
  const order = await db.query.orders.findFirst({
    where: eq(orders.paymentToken, token)
  });
  // Send invoice to the user
  await bot.sendInvoice(chatId, {
    title: 'Custom Watch Order',
    description: `Order #${order.id}`,
    payload: String(order.id),
    currency: 'XTR',              // Telegram Stars
    prices: [{ label: 'Watch', amount: order.totalStars }],
  });
}
```

`currency: 'XTR'` tells Telegram to use Stars. The `amount` is in whole Stars (no cents).

### Step 4 — Pre-checkout Query

Telegram sends a `pre_checkout_query` before confirming payment. The server must respond within 10 seconds:

```ts
bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
  // true = approved, false = declined with error message
});
```

The server always approves unless the order has been cancelled (in which case it returns `false` with an explanation).

### Step 5 — Successful Payment Webhook

Telegram sends a `successful_payment` message to the bot:

```ts
bot.on('message', async (msg) => {
  if (msg.successful_payment) {
    const orderId = parseInt(msg.successful_payment.invoice_payload);
    const chargeId = msg.successful_payment.telegram_payment_charge_id;

    await db.update(orders)
      .set({
        status: 'paid',
        telegramPaymentChargeId: chargeId,
        telegramId: String(msg.from.id),
      })
      .where(eq(orders.id, orderId));

    // Send receipt / confirmation to user
    await bot.sendMessage(chatId, `✅ Payment confirmed! Order #${orderId}`);
    // Also sends a 3D watch animation GIF generated with sharp
  }
});
```

---

## Refunds

Telegram Stars can be refunded programmatically using the `refundStarPayment` API method. The server calls this automatically when an admin cancels a paid order:

```ts
// orders.ts — PATCH /orders/:id/status → "cancelled"
if (order.telegramPaymentChargeId && order.telegramId) {
  await bot.refundStarPayment(
    parseInt(order.telegramId),
    order.telegramPaymentChargeId
  );
}
```

The Stars are returned to the user's Telegram wallet immediately. There is no delay or approval step on the Telegram side.

---

## Payment Expiration Worker

A background worker runs every 60 seconds and cancels stale orders:

```ts
// Cancels orders that have been payment_pending for > 10 minutes
await db.update(orders)
  .set({ status: 'cancelled' })
  .where(
    and(
      eq(orders.status, 'payment_pending'),
      lt(orders.createdAt, tenMinutesAgo)
    )
  );
```

This prevents the order list from filling with orphaned pending orders if users abandon the payment flow.

---

## Telegram Bot Setup Checklist

- [ ] Create bot via @BotFather → `/newbot`
- [ ] Set `TELEGRAM_BOT_TOKEN` secret
- [ ] Set `TELEGRAM_BOT_USERNAME` secret (without `@`)
- [ ] Enable Stars payments in BotFather: `/mybots` → your bot → **Payments** → **Telegram Stars**
- [ ] Deploy API server to a public HTTPS URL
- [ ] Verify webhook is registered: `GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

The server auto-registers the webhook on startup using the `REPLIT_DOMAINS` env variable. To re-register manually:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/api/bot/webhook"
```

---

## QR Code Generation

QR codes are rendered client-side using `qrcode.react`:

```tsx
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={`https://t.me/${BOT_USERNAME}?start=pay_${order.paymentToken}`}
  size={200}
  level="M"
/>
```

The SVG QR code is rendered inline — no external API call needed.

---

## Watch Preview in Bot Messages

When the order is confirmed (`successful_payment`), the bot sends a visual receipt. The server generates a PNG preview of the configured watch using the `/api/watch-preview/:configId` endpoint, which uses `sharp` to composite watch SVG layers into a bitmap.

```
GET /api/watch-preview/:configId
  → reads watch_configs by ID
  → renders SVG with the config params
  → converts to PNG with sharp
  → returns image/png
```

The bot then uses `sendPhoto` to deliver the image to the user.
