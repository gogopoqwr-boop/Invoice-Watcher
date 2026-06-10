import app from "./app";
import { logger } from "./lib/logger";
import { db, adminUsersTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  ensureAdminUsers().catch((err) => logger.error({ err }, "Admin seed error"));
  registerWebhook().catch((err) => logger.error({ err }, "Webhook registration error"));
});
