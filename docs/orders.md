# Orders & Tracking

← [Back to README](../README.md)

---

## Order Lifecycle

Orders follow a strict state machine. Transitions are one-directional except for cancellation which can happen from several states.

```
payment_pending
      │
      │  user pays via Telegram Stars
      ▼
    paid
      │
      │  admin moves to processing
      ▼
 processing
      │
      │  courier ships + adds tracking code
      ▼
  shipping
      │
      │  courier marks as delivered
      ▼
  arrived
```

Cancellation paths:

```
payment_pending  →  cancelled        (auto after 10 min, or user abandons)
paid             →  cancel_requested (user requests via UI)
cancel_requested →  cancelled        (admin approves — triggers auto-refund)
processing       →  cancelled        (admin decision — triggers auto-refund if paid)
```

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| `payment_pending` | Order created, awaiting Telegram Stars payment |
| `paid` | Stars received, production queue entry |
| `processing` | Being manufactured / assembled |
| `shipping` | Handed to courier, tracking code assigned |
| `arrived` | Delivered to buyer |
| `cancel_requested` | User requested cancellation — awaiting admin approval |
| `cancelled` | Cancelled; Stars refunded if payment was received |

---

## API Endpoints

### Create order

```
POST /api/orders
Authorization: not required (session-based)
Body: {
  configId: number,
  totalStars: number
}
Response: {
  id, status, paymentToken, createdAt, ...
}
```

### List my orders

```
GET /api/orders/my
Header: X-Session-ID: <session_id>

Returns all orders belonging to the current anonymous session.
```

### Get single order

```
GET /api/orders/:id
```

### Update order status (admin/courier)

```
PATCH /api/orders/:id/status
Authorization: Bearer <jwt>   (admin or courier role)
Body: {
  status: "processing" | "shipping" | "arrived" | "cancelled",
  trackingCode?: string       (required when status = "shipping")
}
```

When `status = "cancelled"` and the order has a `telegramPaymentChargeId`, the server automatically issues a Stars refund before updating the row.

### Request cancellation (user)

```
POST /api/orders/:id/cancel
Header: X-Session-ID: <session_id>

Transitions status to cancel_requested.
Only works when status is paid, processing, or shipping.
```

---

## Session Tracking

Orders are linked to an anonymous session (not a user account) so buyers can track orders without creating an account.

The session ID is a UUID generated on first visit and stored in `localStorage["session_id"]`. It is sent as an `X-Session-ID` header on all order-related requests. The server uses it to scope order history.

```ts
// Frontend — hooks/use-watch-config.tsx
function getOrCreateSessionId(): string {
  let id = localStorage.getItem('session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('session_id', id);
  }
  return id;
}
```

When the user pays via Telegram, their Telegram user ID is also stored on the order (`telegram_id` column), allowing the bot to send them notifications even if they clear their browser session.

---

## Order Detail Page

`/orders/:id` (`OrderDetail.tsx`) shows:

- **Status timeline** — vertical progress indicator with all statuses, current one highlighted
- **Watch preview** — 3D mini canvas or SVG of the configured watch
- **Configuration summary** — geometry, material, color, bracelet type, serial number
- **Tracking code** — shown as a copyable text field once status is `shipping`
- **Cancel button** — visible when status allows cancellation; transitions to `cancel_requested`
- **"Order again" button** — reloads the same configuration into the configurator

### Status Timeline Component

```tsx
const STEPS = [
  'payment_pending',
  'paid',
  'processing',
  'shipping',
  'arrived',
];

// Renders each step as a circle with a connecting line
// Current step: filled circle
// Past steps: filled + checkmark
// Future steps: empty circle
// Cancelled: red X on the last reached step
```

---

## Polling

While the order is in `payment_pending`, the order detail page polls `GET /api/orders/:id` every **3 seconds** using TanStack Query's `refetchInterval`:

```ts
const { data: order } = useGetOrder(orderId, {
  refetchInterval: order?.status === 'payment_pending' ? 3000 : false,
});
```

Once the status changes from `payment_pending` (to `paid` or `cancelled`), polling stops automatically.

---

## Telegram Notifications

The server sends a bot message to the buyer's Telegram account when certain status transitions occur. This requires the `telegram_id` to be set on the order (it is set at `successful_payment` time).

| Status transition | Bot message sent |
|-------------------|-----------------|
| → `paid` | ✅ Payment confirmed, order #N |
| → `processing` | 🔧 Your watch is being assembled |
| → `shipping` | 🚚 Shipped! Tracking: `<code>` |
| → `arrived` | 📦 Delivered — enjoy your watch |
| → `cancelled` | ❌ Order cancelled, Stars refunded |

The messages include a link back to the order detail page on the website.

---

## Order History Page

`/orders` (`Orders.tsx`) lists all orders for the current session. Shows:

- Thumbnail of the configured watch (WatchMiniCanvas or WatchColorCard)
- Order status badge with color coding
- Creation date
- Total Stars
- Link to order detail

Empty state prompts the user to go configure a watch.
