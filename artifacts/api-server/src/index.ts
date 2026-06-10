import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function registerWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return;

  const domains = process.env.REPLIT_DOMAINS ?? "";
  const primaryDomain = domains.split(",")[0]?.trim();
  if (!primaryDomain) {
    logger.info("REPLIT_DOMAINS not set — skipping webhook auto-registration");
    return;
  }

  const webhookUrl = `https://${primaryDomain}/api/bot/webhook`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "pre_checkout_query"],
      }),
    });
    const json = await res.json() as { ok: boolean; description?: string };
    if (json.ok) {
      logger.info({ webhookUrl }, "Telegram webhook registered");
    } else {
      logger.warn({ webhookUrl, result: json }, "Telegram webhook registration returned not-ok");
    }
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

  registerWebhook().catch((err) => logger.error({ err }, "Webhook registration error"));
});
