# Frontend Pages & Routing

← [Back to README](../README.md)

---

## Router Setup

The app uses **wouter** for client-side routing. Routes are defined in `src/App.tsx` and rendered inside a shared layout shell that includes the top navigation bar and a `<Toaster>` for notifications.

```
/                     Home
/collections          Presets / Collections browser
/configure            3D watch configurator
/box                  Gift-box selection step
/payment/:orderId     Payment QR code + polling
/orders               Session order history
/orders/:id           Single order detail + timeline
/login                Admin / courier login
/admin                Admin panel (role-gated)
```

All routes are lazy-loaded via `React.lazy` + `<Suspense>` to keep the initial bundle small.

---

## Provider Hierarchy

```tsx
// src/App.tsx (simplified)
<QueryClientProvider client={queryClient}>
  <ThemeProvider>
    <AuthProvider>
      <WatchConfigProvider>
        <Router>
          <Routes />
        </Router>
      </WatchConfigProvider>
    </AuthProvider>
  </ThemeProvider>
</QueryClientProvider>
```

- **QueryClientProvider** — TanStack Query cache and devtools
- **ThemeProvider** — light / dark mode (stored in `localStorage["theme"]`)
- **AuthProvider** — JWT state (`use-auth.tsx`); reads `localStorage["jwt"]` on mount
- **WatchConfigProvider** — global configurator state (`use-watch-config.tsx`); persists draft to `localStorage["watch_config_draft"]`

---

## Home (`/`)

**File**: `src/pages/Home.tsx`

Landing page. Two large buttons: **ЧАСЫ** (watches) and **МЕРЧ** (merch). Clicking ЧАСЫ navigates to `/collections`. МЕРЧ is currently a placeholder.

- Animated background (particle field or gradient via CSS)
- Pre-order banner at the top (dismissible, stored in `sessionStorage`)
- Bottom nav links: ЧЕБЛЯЧАС · ВЕРСИЯ 4 · КАНАЛ · ПАНЕЛЬ

---

## Collections (`/collections`)

**File**: `src/pages/Presets.tsx`

Shows all active watch presets grouped by `collection_name`. Each preset is displayed as a card (`WatchPresetCard`) with:

- 3D mini canvas or SVG fallback (`WatchMiniCanvas` / `WatchColorCard`)
- Preset name, description, price in Stars
- "Configure" button → navigates to `/configure?preset=<slug>` and loads the preset config into global state

**Data**: `useListPresets()` (generated hook) — fetches `GET /api/presets`. The query is cached for 5 minutes.

**WebGL slot management**: Up to 8 concurrent WebGL contexts are allocated across all visible cards using `IntersectionObserver`. Cards that scroll out of view release their context slot.

---

## Configure (`/configure`)

**File**: `src/pages/Configure.tsx`

The core page. Split into:

- **Left panel** — full-screen R3F `<Canvas>` rendering `WatchModel`
- **Right panel** — tabbed configuration UI

### Configuration Steps / Tabs

| Step | Tab Label | Controls |
|------|-----------|----------|
| 1 | Геометрия | Case shape (rounded, circle, square, cushion, tonneau) |
| 2 | Материал | Bracelet material (leather, rubber, metal solid/segmented, resin) |
| 3 | Цвет | Watchface color, bracelet color, hands color (hex pickers) |
| 4 | Браслет | Bracelet type (strap, bracelet, nato), width |
| 5 | Стрелки | Hands enabled/disabled, count, color |
| 6 | Текст | Watchface text, text mode (center / circular) |
| 7 | Серийный номер | Serial number string |
| 8 | Коробка | Gift box type and color |

### URL Query Params

- `?preset=<slug>` — loads a preset's config as the starting configuration
- `?config=<id>` — loads a previously saved configuration from the server

### Price Calculator

A live price estimate updates in the panel header as the user changes options. Price is calculated client-side using the `component_prices` settings fetched from `GET /api/admin/prices` (cached).

### Saving & Checkout

When the user clicks **Order**:
1. `POST /api/configurations` saves the current config → returns `configId`
2. `POST /api/orders` creates an order with the `configId` and calculated `totalStars`
3. Redirect to `/payment/:orderId`

---

## Gift Box (`/box`)

**File**: `src/pages/Box.tsx`

Optional step between Configure and Payment for selecting packaging:

- Box type: Standard / Premium / Gift
- Box color
- `WatchBoxScene` — 3D animated gift box (lid opens to reveal the watch)

Selection updates the config state in-place. "Continue" proceeds to checkout.

---

## Payment (`/payment/:orderId`)

**File**: `src/pages/Payment.tsx`

**Purpose**: Bridge the web checkout to the Telegram Stars payment.

### Layout

```
┌─────────────────────────────────────────┐
│  QR Code (encodes t.me/BOT?start=pay_TOKEN) │
│  ──────────────────────────────────────     │
│  [ Open in Telegram ]  (tg:// deep link)    │
│  ──────────────────────────────────────     │
│  Countdown: 09:43 remaining               │
│  Order #42 · 150 ★                        │
└─────────────────────────────────────────┘
```

### Polling

`useGetOrder(orderId, { refetchInterval: 3000 })` polls every 3 seconds while `status === "payment_pending"`. When status changes:
- `paid` → auto-redirect to `/orders/:id`
- `cancelled` → show "Order Expired" with a Repeat button that creates a new order

### Countdown

10-minute timer based on `order.createdAt`. When it reaches zero the page shows a disabled state and a "Repeat Payment" button (creates a fresh order for the same config).

---

## Orders (`/orders`)

**File**: `src/pages/Orders.tsx`

Lists all orders for the current anonymous session (identified by `localStorage["session_id"]`).

**Data**: `useGetMyOrders()` with `X-Session-ID` header.

Each row shows:
- Watch thumbnail (`WatchColorCard` — plain HTML, no WebGL)
- Status badge (color-coded)
- Date, Stars amount
- Link to `/orders/:id`

Empty state: "Вы ещё ничего не заказали" + button to go configure.

---

## Order Detail (`/orders/:id`)

**File**: `src/pages/OrderDetail.tsx`

Full order detail with:

### Status Timeline

Vertical stepper with the 5 main statuses. Each step shows:
- Filled circle + checkmark = completed
- Highlighted circle = current
- Empty circle = future
- Red X on the current step = cancelled

### Watch Preview

`WatchMiniCanvas` (3D or SVG fallback) renders the configured watch.

### Configuration Summary

All fields from `watch_configs` rendered as labelled rows (geometry, material, colors, bracelet, serial number).

### Tracking Code

Visible only when `status === "shipping"`. Rendered as a copyable monospace field.

### Actions

| Button | Visible when | Behaviour |
|--------|-------------|-----------|
| Cancel | `paid` or `processing` | `POST /api/orders/:id/cancel` → `cancel_requested` |
| Order Again | Any | Loads same config into configurator, navigates to `/configure` |

---

## Login (`/login`)

**File**: `src/pages/Login.tsx`

Simple username + password form. No registration — admin accounts are created by admins in the admin panel.

**Flow**:
1. `POST /api/auth/login` with `{ username, password }`
2. Server returns `{ token, role }`
3. Token stored in `localStorage["jwt"]`; `AuthProvider` state updated
4. Redirect: admin → `/admin`, courier → `/admin` (orders tab only)

**Logout**: Removes `localStorage["jwt"]` and resets auth state. No server-side token invalidation (stateless JWT).

---

## Admin (`/admin`)

**File**: `src/pages/Admin.tsx`

Tabbed admin panel. See [Admin Panel & Analytics](admin-panel.md) for full documentation.

Route is not protected at the router level — instead the page itself checks `useAuth()` and redirects to `/login` if no token is present. Tab visibility is gated by `role`.

---

## Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Navbar` | `components/Navbar.tsx` | Top bar with logo, nav links, theme toggle |
| `WatchMiniCanvas` | `components/WatchMiniCanvas.tsx` | WebGL-managed card renderer with IntersectionObserver |
| `WatchColorCard` | `components/WatchColorCard.tsx` | Pure CSS color-swatch card (no WebGL) |
| `WatchSVG` | `components/WatchSVG.tsx` | 2D SVG fallback |
| `StatusBadge` | `components/StatusBadge.tsx` | Color-coded order status pill |
| `PriceDisplay` | `components/PriceDisplay.tsx` | Stars price with ★ icon |
| `ThemeToggle` | `components/ThemeToggle.tsx` | Light/dark switcher |
