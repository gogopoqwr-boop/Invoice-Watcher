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

async function registerWebhook(botToken: string, webhookUrl: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "pre_checkout_query"],
      }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      logger.info({ webhookUrl }, "Telegram webhook registered");
    } else {
      logger.error({ webhookUrl, description: data.description }, "Failed to register Telegram webhook");
    }
  } catch (err) {
    logger.error({ err }, "Error registering Telegram webhook");
  }
}

async function registerTelegramWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — skipping webhook registration");
    return;
  }

  const envUrl = process.env.WEBSITE_URL?.trim().replace(/\/$/, "");
  if (envUrl) {
    const webhookUrl = `${envUrl}/api/bot/webhook`;
    await registerWebhook(botToken, webhookUrl);
    return;
  }

  const domains = process.env.REPLIT_DOMAINS ?? "";
  const primaryDomain = domains.split(",")[0]?.trim();
  if (!primaryDomain) {
    logger.warn("REPLIT_DOMAINS not set and WEBSITE_URL not configured — skipping webhook registration");
    return;
  }

  const webhookUrl = `https://${primaryDomain}/api/bot/webhook`;
  await registerWebhook(botToken, webhookUrl);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  registerTelegramWebhook();
});
