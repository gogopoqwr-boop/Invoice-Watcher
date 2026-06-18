# Admin Panel & Analytics

← [Back to README](../README.md)

---

## Access Control

The admin panel is at `/admin` and is protected by JWT authentication. Two roles exist:

| Role | Can do |
|------|--------|
| `admin` | Everything — orders, analytics, preset CRUD, price config, user management |
| `courier` | Orders only — view and update status (processing → shipping → arrived) |

Login is at `/login`. Credentials are checked against the `admin_users` table with bcrypt. On success the server returns a JWT stored in `localStorage["jwt"]`.

Default seeded credentials:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `FutureAfterWatch3s` | admin |
| `courier1` | `courier123` | courier |

> **Change these immediately on any public deployment.**

To create additional users, use the admin UI or call the API directly:

```
POST /api/admin/users
Authorization: Bearer <admin-jwt>
Body: { username: string, password: string, role: "admin" | "courier" }
```

---

## Admin Panel Layout

The panel is a tabbed interface at `/admin` (`Admin.tsx`). Tabs shown depend on role:

```
Admin role:
  ├── Orders         — full order management
  ├── Analytics      — revenue/conversion charts
  ├── Presets        — collection/preset CRUD
  ├── Prices         — component price table
  └── Users          — courier account management

Courier role:
  └── Orders         — only tab shown
```

---

## Orders Tab

Shows a paginated table of all orders with:

- Order ID, creation date, status badge
- Watch config thumbnail (WatchColorCard)
- Total Stars
- Buyer's Telegram ID (if paid)
- Assigned courier
- Tracking code field (editable inline)

### Status Progression

Admins and couriers can update order status via the inline dropdown or status buttons. Allowed transitions per role:

```
Admin:
  paid          → processing
  processing    → shipping (requires tracking code)
  shipping      → arrived
  any non-arrived → cancelled (triggers auto-refund)
  cancel_requested → cancelled (triggers auto-refund)

Courier:
  processing    → shipping (requires tracking code)
  shipping      → arrived
```

### Auto-Refund on Cancellation

When an admin sets status to `cancelled` and the order has a `telegramPaymentChargeId`:

```ts
// api-server/src/routes/orders.ts
if (newStatus === 'cancelled' && order.telegramPaymentChargeId && order.telegramId) {
  await bot.refundStarPayment(
    parseInt(order.telegramId),
    order.telegramPaymentChargeId
  );
}
```

Stars are returned to the buyer's Telegram wallet automatically. The refund is acknowledged before the database row is updated — if the Telegram API call fails, the status is not updated and an error is returned.

---

## Analytics Tab

Admin-only. Shows aggregate statistics with two time windows selectable (7 days / 30 days):

### Summary Cards

| Metric | Calculation |
|--------|-------------|
| Total Revenue | SUM of `total_stars` where `status != payment_pending AND status != cancelled` |
| Total Orders | COUNT of paid orders |
| Conversion Rate | paid orders / `checkout_start` events × 100 |
| Unique Visitors | DISTINCT `session_id` in `analytics_events` where `event_type = page_visit` |

### Time-Series Charts

Line charts showing daily:
- Order count
- Revenue in Stars
- Page visits
- Checkout starts

Data source: `analytics_events` table + `orders` table joined on `created_at` date.

### API Endpoints

```
GET /api/analytics/summary?days=30
Authorization: Bearer <admin-jwt>

Response: {
  totalRevenue: number,
  totalOrders: number,
  conversionRate: number,
  uniqueVisitors: number,
}

GET /api/analytics/time-series?days=30
Authorization: Bearer <admin-jwt>

Response: Array<{
  date: string,       // "2024-01-15"
  orders: number,
  revenue: number,
  visits: number,
  checkouts: number,
}>
```

---

## Presets Tab (Admin only)

CRUD interface for the watch presets shown in Collections. Each preset has:

- **Name** and **slug** (URL identifier)
- **Collection name** (groups presets on the Collections page)
- **Description**
- **Total Stars** (price)
- All watch config fields: geometry, colors, bracelet type/material, hands, text
- **Sort order** (integer, lower = first)
- **Active** toggle (inactive presets are hidden from buyers)

### API Endpoints

```
GET    /api/admin/presets          — list all (including inactive)
POST   /api/admin/presets          — create
PATCH  /api/admin/presets/:id      — update
DELETE /api/admin/presets/:id      — soft delete (sets active = false)
```

Public endpoint (for buyers, active only):
```
GET /api/presets
GET /api/presets/:id
```

---

## Prices Tab (Admin only)

The component price table is stored as a single JSON blob in the `settings` table under the key `component_prices`. It controls how the configurator calculates the total Stars price as the user customizes their watch.

```json
{
  "base": 10,
  "materials": {
    "leather": 0,
    "rubber": 2,
    "metal_solid": 8,
    "metal_segmented": 10,
    "resin": 5
  },
  "geometry": {
    "rounded": 0,
    "circle": 3,
    "square": 5,
    "cushion": 7,
    "tonneau": 9
  },
  "extras": {
    "serial_number": 2,
    "box": 5
  }
}
```

The admin UI shows an editable JSON or form fields for each price component. Changes take effect immediately for all new orders.

```
GET /api/admin/prices
PUT /api/admin/prices
Authorization: Bearer <admin-jwt>
```

---

## Users Tab (Admin only)

Lists all admin and courier accounts. Admins can:

- **Create** new courier accounts (username + password)
- **Deactivate** couriers (they can no longer log in but historical data is preserved)

Passwords are stored as bcrypt hashes (cost factor 10). The API never returns password hashes.

```
GET    /api/admin/users
POST   /api/admin/users          { username, password, role }
DELETE /api/admin/users/:id
```

---

## Courier Workflow

Couriers log in at `/login` with their credentials. The admin panel loads showing only the Orders tab.

Typical courier session:

1. Log in → see orders list filtered to active orders
2. Find orders in `paid` or `processing` status
3. Mark as `processing` when picked up for manufacturing
4. When shipped: enter tracking code → mark as `shipping`
5. When delivered (confirmed): mark as `arrived`

Orders assigned to a specific courier are shown first. Couriers cannot see other couriers' assigned orders unless they are admin role.

---

## JWT Authentication Details

```
Token payload: { id: number, username: string, role: "admin" | "courier" }
Algorithm: HS256
Secret: JWT_SECRET env variable
Expiry: none (tokens are valid indefinitely — rotate JWT_SECRET to invalidate)
Storage: localStorage["jwt"]
Transport: Authorization: Bearer <token> header
```

The generated `customFetch` (in `@workspace/api-client-react`) reads `localStorage["jwt"]` automatically on every request. No manual header plumbing needed.

To protect a new Express route:

```ts
import { requireAdmin } from './admin';     // admin role only
import { requireCourier } from './auth';    // admin or courier role

router.get('/protected', requireAdmin, handler);
router.patch('/orders/:id/status', requireCourier, handler);
```
