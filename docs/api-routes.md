# API Routes Reference

← [Back to README](../README.md)

---

All routes are prefixed with `/api`. The API server listens on port 8080 in development; in production it shares the domain with the frontend (Replit routes `/api/*` to port 8080).

Request/response bodies are JSON unless otherwise noted.

---

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | — | Log in with username + password → returns JWT |
| `GET` | `/api/auth/me` | Bearer | Returns current user info |

### `POST /api/auth/login`

```json
// Request
{ "username": "admin", "password": "FutureAfterWatch3s" }

// Response 200
{ "token": "<jwt>", "role": "admin" }

// Response 401
{ "error": "Invalid credentials" }
```

---

## Presets (Public)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/presets` | — | List all active presets |
| `GET` | `/api/presets/:id` | — | Single preset by numeric ID |
| `GET` | `/api/presets/slug/:slug` | — | Single preset by slug |

All responses include the full watch config fields plus `name`, `description`, `totalStars`, `collectionName`, `sortOrder`.

---

## Watch Configurations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/configurations` | — | Save a watch config → returns `{ id }` |
| `GET` | `/api/configurations/:id` | — | Fetch a saved config by ID |

### `POST /api/configurations`

Saves the current configurator state to `watch_configs`. Returns the new row's `id`, which is then used when creating an order.

```json
// Request (all fields optional except sessionId)
{
  "sessionId": "uuid",
  "watchfaceGeometry": "rounded",
  "watchfaceColor": "#1a1a2e",
  "braceletMaterial": "leather",
  "braceletType": "strap",
  "braceletColor": "#2d2d2d",
  "handsEnabled": true,
  "handsCount": 3,
  "handsColor": "#ffffff",
  "watchfaceText": "ЧЕБЛЯЧАС",
  "watchfaceTextMode": "center",
  "serialNumber": "CHB-001",
  "boxType": "standard",
  "boxColor": "#000000"
}

// Response 201
{ "id": 42 }
```

---

## Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/orders` | — | Create a new order |
| `GET` | `/api/orders/my` | X-Session-ID header | List orders for current session |
| `GET` | `/api/orders/:id` | — | Single order detail |
| `PATCH` | `/api/orders/:id/status` | Bearer (courier+) | Update order status |
| `POST` | `/api/orders/:id/cancel` | X-Session-ID header | User requests cancellation |

### `POST /api/orders`

```json
// Request
{ "configId": 42, "totalStars": 150 }

// Response 201
{
  "id": 7,
  "status": "payment_pending",
  "paymentToken": "a3f8b2c1...",   // 32 hex chars
  "totalStars": 150,
  "configId": 42,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### `GET /api/orders/my`

Requires `X-Session-ID: <uuid>` header. Returns array of orders for that session, most recent first.

### `PATCH /api/orders/:id/status`

```json
// Request
{
  "status": "shipping",
  "trackingCode": "RU123456789"   // required when status = "shipping"
}

// Response 200 — updated order object
```

When `status = "cancelled"` and the order has a `telegramPaymentChargeId`, the server calls `refundStarPayment` before updating the row. If the refund fails, the status update is rejected and a 502 is returned.

---

## Bot

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/bot/webhook` | Telegram signature | Telegram webhook receiver |
| `POST` | `/api/bot/register` | Bearer (admin) | Manually re-register webhook URL |

The webhook is registered automatically on server startup using `REPLIT_DOMAINS`. Manual re-registration is rarely needed.

---

## Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/analytics/event` | — | Record an analytics event |
| `GET` | `/api/analytics/summary` | Bearer (admin) | Aggregate stats |
| `GET` | `/api/analytics/time-series` | Bearer (admin) | Daily breakdown |

### `POST /api/analytics/event`

```json
// Request
{
  "eventType": "page_visit",       // or "checkout_start"
  "sessionId": "uuid",
  "metadata": { "page": "/configure" }
}

// Response 204
```

### `GET /api/analytics/summary?days=30`

```json
{
  "totalRevenue": 4500,
  "totalOrders": 30,
  "conversionRate": 12.5,
  "uniqueVisitors": 240
}
```

### `GET /api/analytics/time-series?days=30`

```json
[
  {
    "date": "2024-01-15",
    "orders": 3,
    "revenue": 450,
    "visits": 87,
    "checkouts": 12
  }
  // … one entry per day
]
```

---

## Admin — Presets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/presets` | Bearer (admin) | List all presets (including inactive) |
| `POST` | `/api/admin/presets` | Bearer (admin) | Create a preset |
| `PATCH` | `/api/admin/presets/:id` | Bearer (admin) | Update a preset |
| `DELETE` | `/api/admin/presets/:id` | Bearer (admin) | Deactivate (soft delete) |

---

## Admin — Prices

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/prices` | Bearer (admin) | Get component price table |
| `PUT` | `/api/admin/prices` | Bearer (admin) | Replace component price table |

The price table is a single JSON blob stored in `settings` under key `component_prices`. See [Admin Panel](admin-panel.md) for the schema.

---

## Admin — Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/users` | Bearer (admin) | List all admin/courier accounts |
| `POST` | `/api/admin/users` | Bearer (admin) | Create a new account |
| `DELETE` | `/api/admin/users/:id` | Bearer (admin) | Delete an account |

```json
// POST /api/admin/users request
{ "username": "courier2", "password": "secure123", "role": "courier" }
```

---

## Admin — File Upload

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/upload-texture` | Bearer (admin) | Upload a texture image |

- **Content-Type**: `multipart/form-data`
- **Field name**: `file`
- **Limit**: 8 MB
- **Accepted**: `image/*` only
- **Returns**: `{ "url": "/api/uploads/<filename>" }`

Uploaded files are saved to `artifacts/api-server/uploads/` and served as static files at `/api/uploads/*`.

---

## Watch Preview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/watch-preview/:configId` | — | PNG preview of a saved config |
| `GET` | `/api/watch-preview/:configId/gif` | — | Animated GIF preview (for bot messages) |

These endpoints use `sharp` to composite SVG layers into a bitmap. Used by the Telegram bot when sending payment confirmations.

---

## Error Responses

All error responses follow the shape:

```json
{ "error": "Human-readable message" }
```

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Validation error (Zod) or missing required fields |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT but insufficient role |
| 404 | Resource not found |
| 409 | Conflict (e.g. order already paid) |
| 502 | Telegram API call failed (refund, webhook) |
| 500 | Unexpected server error |

---

## Adding a New Route

1. Add the endpoint to `lib/api-spec/openapi.yaml`
2. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
3. Create the handler in `artifacts/api-server/src/routes/<router>.ts`
4. Register the router in `artifacts/api-server/src/index.ts`
5. Use the generated Zod schema from `@workspace/api-zod` for request validation
6. Use the generated hook from `@workspace/api-client-react` in the frontend

See [Development Guide](development-guide.md) for the full walkthrough.
