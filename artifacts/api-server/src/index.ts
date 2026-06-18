import app from "./app";
import { logger } from "./lib/logger";
import { db, adminUsersTable, ordersTable, watchPresetsTable } from "@workspace/db";
import { count, eq, lt, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const PRESET_SEED = [
  // ── КЛАССИКА ──────────────────────────────────────────────────────────────
  { name: "Midnight Steel",  description: "Брутальная нержавейка, тёмный циферблат",           collectionName: null,               watchfaceGeometry: "circle", watchfaceMaterial: "metal",    watchfaceColor: "#0f172a", braceletMaterial: "metal_solid",   braceletType: "solid",     braceletColor: "#1e293b", handsEnabled: true,  handsColor: "#cbd5e1", watchfaceText: null,                   watchfaceTextMode: "center",   priceStars: 300,  maxQuantity: 1000 },
  { name: "Arctic Frost",    description: "Белоснежная керамика, полярная чистота",             collectionName: null,               watchfaceGeometry: "circle", watchfaceMaterial: "plastic",  watchfaceColor: "#f8fafc", braceletMaterial: "plastic_solid", braceletType: "solid",     braceletColor: "#e2e8f0", handsEnabled: true,  handsColor: "#0f172a", watchfaceText: null,                   watchfaceTextMode: "center",   priceStars: 200,  maxQuantity: 1000 },
  { name: "Crimson Core",    description: "Алый акцент, стальной корпус",                      collectionName: null,               watchfaceGeometry: "circle", watchfaceMaterial: "metal",    watchfaceColor: "#7f1d1d", braceletMaterial: "leather",       braceletType: "solid",     braceletColor: "#1c1917", handsEnabled: true,  handsColor: "#fbbf24", watchfaceText: null,                   watchfaceTextMode: "center",   priceStars: 300,  maxQuantity: 1000 },
  { name: "Carbon Ghost",    description: "Угольный карбон, невидимость в темноте",             collectionName: null,               watchfaceGeometry: "square", watchfaceMaterial: "plastic",  watchfaceColor: "#0a0a0a", braceletMaterial: "resin",         braceletType: "solid",     braceletColor: "#171717", handsEnabled: false, handsColor: "#ffffff", watchfaceText: null,                   watchfaceTextMode: "center",   priceStars: 300,  maxQuantity: 1000 },
  { name: "Gold Rush",       description: "Роскошное золото, классика вне времени",             collectionName: null,               watchfaceGeometry: "drawn",  watchfaceMaterial: "metal",    watchfaceColor: "#78350f", braceletMaterial: "metal_segmented",braceletType: "segmented", braceletColor: "#b8860b", handsEnabled: true,  handsColor: "#fbbf24", watchfaceText: null,                   watchfaceTextMode: "center",   priceStars: 200,  maxQuantity: 1000 },
  { name: "Ocean Drive",     description: "Морская синева, дух свободы",                       collectionName: null,               watchfaceGeometry: "circle", watchfaceMaterial: "plastic",  watchfaceColor: "#1e3a5f", braceletMaterial: "cotton_fabric", braceletType: "solid",     braceletColor: "#1e40af", handsEnabled: true,  handsColor: "#60a5fa", watchfaceText: null,                   watchfaceTextMode: "center",   priceStars: 200,  maxQuantity: 1000 },
  // ── bipolar ───────────────────────────────────────────────────────────────
  { name: "ПОЛОВИНКА",   description: "Левая — счастье. Правая — горе. Правда жизни на запястье.",       collectionName: "bipolar", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#f7e28a", braceletMaterial: "resin",         braceletType: "solid", braceletColor: "#6b7280", handsEnabled: false, handsColor: "#1a1a1a", watchfaceText: "EYE:halfmood",  watchfaceTextMode: "center", priceStars: 1000, maxQuantity: 1000 },
  { name: "КАПЛИ",       description: "Просто капли. Много. Везде. Не плачем — так получилось.",          collectionName: "bipolar", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#dbeafe", braceletMaterial: "resin",         braceletType: "solid", braceletColor: "#93c5fd", handsEnabled: false, handsColor: "#1e40af", watchfaceText: "EYE:drops",     watchfaceTextMode: "center", priceStars: 1000, maxQuantity: 1000 },
  { name: "СОЛНЫШКО",    description: "Всё лучики. Ярко до боли в глазах. Хорошо же.",                   collectionName: "bipolar", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#fef08a", braceletMaterial: "resin",         braceletType: "solid", braceletColor: "#fde047", handsEnabled: false, handsColor: "#713f12", watchfaceText: "EYE:sunny",     watchfaceTextMode: "center", priceStars: 1000, maxQuantity: 1000 },
  { name: "MOOD",        description: "Просто слово. Никаких объяснений. Сам разберись.",                 collectionName: "bipolar", watchfaceGeometry: "drawn",  watchfaceMaterial: "plastic", watchfaceColor: "#6d28d9", braceletMaterial: "resin",         braceletType: "solid", braceletColor: "#a855f7", handsEnabled: true,  handsColor: "#fde68a", watchfaceText: "MOOD",          watchfaceTextMode: "center", priceStars: 2000, maxQuantity: 1000 },
  { name: "СЛЁЗЫ",       description: "Глаза смотрят. Слёзы — вниз. Как стрелки. Тихо.",                 collectionName: "bipolar", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#0ea5e9", braceletMaterial: "resin",         braceletType: "solid", braceletColor: "#38bdf8", handsEnabled: false, handsColor: "#ffffff", watchfaceText: "EYE:cry",       watchfaceTextMode: "center", priceStars: 17,   maxQuantity: 1000 },
  { name: "ГРОЗА",       description: "Молния в центре. Всё остальное сгорело. Нормально.",               collectionName: "bipolar", watchfaceGeometry: "square", watchfaceMaterial: "plastic", watchfaceColor: "#1e1b4b", braceletMaterial: "resin",         braceletType: "solid", braceletColor: "#312e81", handsEnabled: true,  handsColor: "#fbbf24", watchfaceText: "EYE:lightning", watchfaceTextMode: "center", priceStars: 676,  maxQuantity: 1000 },
  // ── РОФЛ ──────────────────────────────────────────────────────────────────
  { name: "ДОХУИЩА",                description: "Ядрёная красота. Текст по кругу, буквы в хаосе.",            collectionName: "РОФЛ", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#dc2626", braceletMaterial: "resin",         braceletType: "solid",     braceletColor: "#ef4444", handsEnabled: true,  handsColor: "#ffffff", watchfaceText: "ДОХУИЩА",             watchfaceTextMode: "circular", priceStars: 6767, maxQuantity: 1000 },
  { name: "МНОГО",                  description: "Жёлтый крик. Слишком громко на любое запястье.",             collectionName: "РОФЛ", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#ca8a04", braceletMaterial: "cotton_fabric", braceletType: "solid",     braceletColor: "#facc15", handsEnabled: true,  handsColor: "#1a1a1a", watchfaceText: "МНОГО",               watchfaceTextMode: "circular", priceStars: 5656, maxQuantity: 1000 },
  { name: "АЛЕ",                    description: "Зелёный шок. Кольцевые буквы. Алёёё??",                      collectionName: "РОФЛ", watchfaceGeometry: "square", watchfaceMaterial: "plastic", watchfaceColor: "#15803d", braceletMaterial: "plastic_solid", braceletType: "solid",     braceletColor: "#22c55e", handsEnabled: true,  handsColor: "#f0fdf4", watchfaceText: "АЛЕ",                 watchfaceTextMode: "circular", priceStars: 5252, maxQuantity: 1000 },
  { name: "TOO MUCH",               description: "Фиолетовый хаос на запястье. Слишком.",                      collectionName: "РОФЛ", watchfaceGeometry: "drawn",  watchfaceMaterial: "plastic", watchfaceColor: "#6d28d9", braceletMaterial: "resin",         braceletType: "solid",     braceletColor: "#a855f7", handsEnabled: true,  handsColor: "#fde68a", watchfaceText: "TOO MUCH",            watchfaceTextMode: "circular", priceStars: 1000, maxQuantity: 1000 },
  { name: "БЕЗ ПЯТИ ШЕСТЬ УТРОВ",  description: "Оранжевый рассвет. Дедлайны горят синим пламенем.",         collectionName: "РОФЛ", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#c2410c", braceletMaterial: "leather",       braceletType: "solid",     braceletColor: "#7c2d12", handsEnabled: false, handsColor: "#fed7aa", watchfaceText: "БЕЗ ПЯТИ ШЕСТЬ УТРОВ", watchfaceTextMode: "circular", priceStars: 1000, maxQuantity: 1000 },
  { name: "ЧЕТЫРЕ ЧАСОВ ЧАСА",      description: "Полночный кризис. Грамматика устала вместе с тобой.",       collectionName: "РОФЛ", watchfaceGeometry: "square", watchfaceMaterial: "plastic", watchfaceColor: "#1e1b4b", braceletMaterial: "resin",         braceletType: "solid",     braceletColor: "#312e81", handsEnabled: true,  handsColor: "#a5b4fc", watchfaceText: "ЧЕТЫРЕ ЧАСОВ ЧАСА",   watchfaceTextMode: "circular", priceStars: 500,  maxQuantity: 1000 },
  { name: "A LOT",                  description: "Максимально международно. Просто A LOT.",                   collectionName: "РОФЛ", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#0f172a", braceletMaterial: "cotton_fabric", braceletType: "solid",     braceletColor: "#1e293b", handsEnabled: true,  handsColor: "#e2e8f0", watchfaceText: "A LOT",               watchfaceTextMode: "circular", priceStars: 666,  maxQuantity: 1000 },
  // ── ГИПЕРСЕРЬЕЗНОСТЬ ──────────────────────────────────────────────────────
  { name: "KPI",      description: "Часы для людей, чьи KPI не сходятся с дедлайном бытия.",      collectionName: "ГИПЕРСЕРЬЕЗНОСТЬ", watchfaceGeometry: "square",  watchfaceMaterial: "metal", watchfaceColor: "#09090b", braceletMaterial: "metal_solid",    braceletType: "solid",     braceletColor: "#18181b", handsEnabled: true,  handsColor: "#e4e4e7", watchfaceText: "KPI",    watchfaceTextMode: "center", priceStars: 4242, maxQuantity: 1000 },
  { name: "DEADLINE", description: "Вместо делений — одно слово. Всё, что нужно знать.",          collectionName: "ГИПЕРСЕРЬЕЗНОСТЬ", watchfaceGeometry: "square",  watchfaceMaterial: "metal", watchfaceColor: "#1c1917", braceletMaterial: "metal_solid",    braceletType: "solid",     braceletColor: "#292524", handsEnabled: false, handsColor: "#d6d3d1", watchfaceText: "DEAD\nLINE", watchfaceTextMode: "center", priceStars: 6969, maxQuantity: 1000 },
  { name: "Q1",       description: "Серый стандарт. Квартал не ждёт. Никогда.",                   collectionName: "ГИПЕРСЕРЬЕЗНОСТЬ", watchfaceGeometry: "circle",  watchfaceMaterial: "metal", watchfaceColor: "#27272a", braceletMaterial: "metal_segmented",braceletType: "segmented", braceletColor: "#3f3f46", handsEnabled: true,  handsColor: "#a1a1aa", watchfaceText: "Q1",     watchfaceTextMode: "center", priceStars: 5555, maxQuantity: 1000 },
  { name: "ASAP",     description: "Дресс-код тёмно-синий. Ответить нужно было вчера.",           collectionName: "ГИПЕРСЕРЬЕЗНОСТЬ", watchfaceGeometry: "drawn",   watchfaceMaterial: "metal", watchfaceColor: "#0f172a", braceletMaterial: "leather",        braceletType: "solid",     braceletColor: "#1e293b", handsEnabled: true,  handsColor: "#f8fafc", watchfaceText: "ASAP",   watchfaceTextMode: "center", priceStars: 5243, maxQuantity: 1000 },
  { name: "EXEC",     description: "Золотые стрелки на угольном. Молчаливое превосходство.",      collectionName: "ГИПЕРСЕРЬЕЗНОСТЬ", watchfaceGeometry: "circle",  watchfaceMaterial: "metal", watchfaceColor: "#111827", braceletMaterial: "metal_segmented",braceletType: "segmented", braceletColor: "#1f2937", handsEnabled: true,  handsColor: "#f59e0b", watchfaceText: null,     watchfaceTextMode: "center", priceStars: 1697, maxQuantity: 1000 },
  // ── ЖИВНОСТЬ ──────────────────────────────────────────────────────────────
  { name: "ПАУК",   description: "Членистоногий. Восемь точек зрения на ваш запрос.",             collectionName: "ЖИВНОСТЬ", watchfaceGeometry: "drawn",  watchfaceMaterial: "plastic", watchfaceColor: "#0a0a0a", braceletMaterial: "metal_segmented", braceletType: "segmented", braceletColor: "#1a1a1a", handsEnabled: true,  handsColor: "#4ade80", watchfaceText: "EYE:spider",  watchfaceTextMode: "center", priceStars: 2000, maxQuantity: 1000 },
  { name: "КРАКЕН", description: "Из глубины. Присоски, щупальца, вертикальный зрачок.",         collectionName: "ЖИВНОСТЬ", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#0c4a6e", braceletMaterial: "resin",            braceletType: "solid",     braceletColor: "#075985", handsEnabled: false, handsColor: "#7dd3fc", watchfaceText: "EYE:squid",  watchfaceTextMode: "center", priceStars: 2000, maxQuantity: 1000 },
  { name: "ДРАКОН", description: "Чешуя, когти, рептильный глаз не моргает просто так.",         collectionName: "ЖИВНОСТЬ", watchfaceGeometry: "drawn",  watchfaceMaterial: "plastic", watchfaceColor: "#7f1d1d", braceletMaterial: "leather",          braceletType: "solid",     braceletColor: "#451a03", handsEnabled: true,  handsColor: "#fde68a", watchfaceText: "EYE:reptile",watchfaceTextMode: "center", priceStars: 2000, maxQuantity: 1000 },
  { name: "ЧУДИК",  description: "Мохнатый паразит с выпученными глазами. Обнимает крепко.",     collectionName: "ЖИВНОСТЬ", watchfaceGeometry: "circle", watchfaceMaterial: "plastic", watchfaceColor: "#4a044e", braceletMaterial: "cotton_fabric",    braceletType: "solid",     braceletColor: "#7e22ce", handsEnabled: true,  handsColor: "#f0abfc", watchfaceText: "EYE:gremlin",watchfaceTextMode: "center", priceStars: 2000, maxQuantity: 1000 },
  { name: "КИБЕР",  description: "Прозрачный полимер, пульсирующие вены, биомеханические зажимы.",collectionName: "ЖИВНОСТЬ", watchfaceGeometry: "square", watchfaceMaterial: "plastic", watchfaceColor: "#042f2e", braceletMaterial: "resin",            braceletType: "solid",     braceletColor: "#134e4a", handsEnabled: false, handsColor: "#5eead4", watchfaceText: "EYE:cyber",  watchfaceTextMode: "center", priceStars: 2000, maxQuantity: 1000 },
];

async function ensurePresets() {
  const existing = await db.select({ name: watchPresetsTable.name }).from(watchPresetsTable);
  const existingNames = new Set(existing.map(r => r.name));
  const missing = PRESET_SEED.filter(p => !existingNames.has(p.name));
  if (missing.length === 0) return;

  logger.info({ count: missing.length }, "Seeding missing presets...");
  for (const preset of missing) {
    try {
      await db.insert(watchPresetsTable).values(preset as any);
    } catch (err) {
      logger.error({ err, name: preset.name }, "Failed to seed preset");
    }
  }
  logger.info({ count: missing.length }, "Presets seeded");
}

async function ensureAdminUsers() {
  const SEED_USERS = [
    { username: "admin",    password: "FutureAfterWatch3s", role: "admin"   },
    { username: "courier1", password: "courier123",          role: "courier" },
  ] as const;

  for (const u of SEED_USERS) {
    const existing = await db
      .select({ id: adminUsersTable.id, hash: adminUsersTable.passwordHash })
      .from(adminUsersTable)
      .where(eq(adminUsersTable.username, u.username))
      .limit(1);

    if (existing.length === 0) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.insert(adminUsersTable).values({ username: u.username, passwordHash: hash, role: u.role });
      logger.info({ username: u.username }, "Admin user seeded");
    } else {
      const matches = await bcrypt.compare(u.password, existing[0].hash);
      if (!matches) {
        const hash = await bcrypt.hash(u.password, 10);
        await db.update(adminUsersTable)
          .set({ passwordHash: hash })
          .where(eq(adminUsersTable.username, u.username));
        logger.info({ username: u.username }, "Admin user password corrected");
      }
    }
  }
}

async function registerWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return;

  const domains = process.env.REPLIT_DOMAINS ?? "";
  const primaryDomain = domains.split(",")[0]?.trim();
  if (!primaryDomain) return;

  const webhookUrl = `https://${primaryDomain}/api/bot/webhook`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "pre_checkout_query"] }),
    });
    const json = await res.json() as { ok: boolean; description?: string };
    if (json.ok) logger.info({ webhookUrl }, "Telegram webhook registered");
    else logger.warn({ webhookUrl, result: json }, "Telegram webhook registration returned not-ok");
  } catch (err) {
    logger.error({ err }, "Failed to auto-register Telegram webhook");
  }
}

// ── Payment expiration worker ─────────────────────────────────────────────────
// Cancels payment_pending orders older than 10 minutes every 60 seconds.
function startPaymentExpirationWorker() {
  const TEN_MINUTES = 10 * 60 * 1000;
  const CHECK_INTERVAL = 60_000;

  const check = async () => {
    try {
      const cutoff = new Date(Date.now() - TEN_MINUTES);
      const expired = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.status, "payment_pending"),
            lt(ordersTable.createdAt, cutoff),
          ),
        );

      if (expired.length === 0) return;

      for (const { id } of expired) {
        await db
          .update(ordersTable)
          .set({
            status: "cancelled",
            cancelComment: "Истёк срок оплаты (10 мин)",
            updatedAt: new Date(),
          })
          .where(eq(ordersTable.id, id));
        logger.info({ orderId: id }, "Order auto-cancelled: payment expired");
      }
    } catch (err) {
      logger.error({ err }, "Payment expiration worker error");
    }
  };

  setInterval(check, CHECK_INTERVAL);
  logger.info("Payment expiration worker started (checks every 60s)");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  ensurePresets().catch((err) => logger.error({ err }, "Preset seed error"));
  ensureAdminUsers().catch((err) => logger.error({ err }, "Admin seed error"));
  registerWebhook().catch((err) => logger.error({ err }, "Webhook registration error"));
  startPaymentExpirationWorker();
});
