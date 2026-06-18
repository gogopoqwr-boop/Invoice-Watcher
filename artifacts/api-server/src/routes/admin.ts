import { Router } from "express";
import { db, watchPresetsTable, adminUsersTable, settingsTable, ordersTable, watchConfigsTable, botUsersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "fallback_dev_secret_2024";

// ── Admin-only JWT middleware ────────────────────────────────────────────────

function requireAdmin(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as { id: number; role: string };
    if (decoded.role !== "admin") return res.status(403).json({ error: "Admin only" });
    req.adminUser = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ── File upload (textures) ───────────────────────────────────────────────────

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);
    cb(ok ? null : new Error("Only image files allowed") as any, ok);
  },
});

router.post("/admin/upload-texture", requireAdmin, upload.single("file"), (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url });
});

// ── Presets CRUD ─────────────────────────────────────────────────────────────

const TEXTURE_FIELDS = ["customWatchfaceUrl", "skinStripeUrl", "skinFullUrl"];

router.get("/admin/presets", requireAdmin, async (req, res) => {
  try {
    const presets = await db.select().from(watchPresetsTable).orderBy(watchPresetsTable.id);
    res.json(presets);
  } catch (err: any) {
    req.log.error({ err }, "admin presets list failed");
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/admin/presets", requireAdmin, async (req, res) => {
  try {
    const body = req.body;
    const data: any = {
      name: body.name ?? "Новый пресет",
      description: body.description ?? null,
      watchfaceGeometry: body.watchfaceGeometry ?? "circle",
      watchfaceMaterial: body.watchfaceMaterial ?? "metal",
      watchfaceColor: body.watchfaceColor ?? "#1e293b",
      braceletMaterial: body.braceletMaterial ?? "metal_solid",
      braceletType: body.braceletType ?? "solid",
      braceletColor: body.braceletColor ?? "#0f172a",
      handsEnabled: body.handsEnabled !== false,
      handsColor: body.handsColor ?? "#cbd5e1",
      priceStars: Number(body.priceStars ?? 10),
      collectionName: body.collectionName ?? null,
      boxType: body.boxType ?? "standard",
      watchfaceText: body.watchfaceText ?? null,
      watchfaceTextMode: body.watchfaceTextMode ?? "center",
      maxQuantity: Number(body.maxQuantity ?? 1000),
    };
    for (const f of TEXTURE_FIELDS) {
      if (f in body) data[f] = body[f] || null;
    }
    const [preset] = await db.insert(watchPresetsTable).values(data).returning();
    res.status(201).json(preset);
  } catch (err: any) {
    req.log.error({ err }, "admin create preset failed");
    res.status(500).json({ error: "Failed to create preset" });
  }
});

router.patch("/admin/presets/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const body = req.body;
    const updates: any = {};
    const fields = [
      "name","description","watchfaceGeometry","watchfaceMaterial","watchfaceColor",
      "braceletMaterial","braceletType","braceletColor","handsEnabled","handsColor",
      "priceStars","collectionName","boxType","watchfaceText","watchfaceTextMode","maxQuantity",
      "watchfaceBackgroundType","watchfaceGradientEnd","handsCount",
      ...TEXTURE_FIELDS,
    ];
    for (const f of fields) {
      if (f in body) updates[f] = f === "priceStars" || f === "maxQuantity" ? Number(body[f]) : body[f];
    }
    const [preset] = await db.update(watchPresetsTable).set(updates)
      .where(eq(watchPresetsTable.id, id)).returning();
    if (!preset) return res.status(404).json({ error: "Not found" });
    res.json(preset);
  } catch (err: any) {
    req.log.error({ err }, "admin update preset failed");
    res.status(500).json({ error: "Failed to update preset" });
  }
});

router.delete("/admin/presets/:id", requireAdmin, async (req, res) => {
  try {
    await db.delete(watchPresetsTable).where(eq(watchPresetsTable.id, parseInt(req.params.id, 10)));
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "admin delete preset failed");
    res.status(500).json({ error: "Failed to delete preset" });
  }
});

// ── Users CRUD ───────────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await db.select({
      id: adminUsersTable.id,
      username: adminUsersTable.username,
      role: adminUsersTable.role,
      createdAt: adminUsersTable.createdAt,
    }).from(adminUsersTable).orderBy(adminUsersTable.id);
    res.json(users);
  } catch (err: any) {
    req.log.error({ err }, "admin list users failed");
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/admin/users", requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username?.trim() || !password) return res.status(400).json({ error: "Username and password required" });
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(adminUsersTable)
      .values({ username: username.trim(), passwordHash, role: role ?? "courier" })
      .returning({ id: adminUsersTable.id, username: adminUsersTable.username, role: adminUsersTable.role, createdAt: adminUsersTable.createdAt });
    res.status(201).json(user);
  } catch (err: any) {
    req.log.error({ err }, "admin create user failed");
    res.status(409).json({ error: "Username already exists or error" });
  }
});

router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { username, password, role } = req.body;
    const updates: any = {};
    if (username?.trim()) updates.username = username.trim();
    if (role) updates.role = role;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to update" });
    const [user] = await db.update(adminUsersTable).set(updates)
      .where(eq(adminUsersTable.id, id))
      .returning({ id: adminUsersTable.id, username: adminUsersTable.username, role: adminUsersTable.role, createdAt: adminUsersTable.createdAt });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err: any) {
    req.log.error({ err }, "admin update user failed");
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === (req as any).adminUser.id) return res.status(400).json({ error: "Cannot delete yourself" });
    await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "admin delete user failed");
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ── Orders CSV export ─────────────────────────────────────────────────────────

router.get("/admin/orders/export", requireAdmin, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;

    const orders = await db.select().from(ordersTable)
      .where(status ? eq(ordersTable.status, status) : undefined)
      .orderBy(desc(ordersTable.createdAt));

    const configs = await db.select().from(watchConfigsTable);
    const configMap = new Map(configs.map(c => [c.id, c]));

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = [
      "ID", "Статус", "Звёзды", "Email", "Адрес",
      "Telegram", "TG ID", "Вкладыш", "Пресет",
      "Корпус", "Ремешок", "Дата",
    ].map(escape).join(",");

    const rows = orders.map(o => {
      const cfg = configMap.get(o.configId);
      return [
        o.id,
        o.status,
        o.totalStars,
        o.deliveryEmail ?? o.userEmail ?? "",
        o.deliveryAddress ?? "",
        o.telegramUsername ?? "",
        o.telegramId ?? "",
        o.boxMessage ?? "",
        (cfg as any)?.presetName ?? "",
        cfg?.watchfaceMaterial ?? "",
        cfg?.braceletMaterial ?? "",
        new Date(o.createdAt).toISOString(),
      ].map(escape).join(",");
    });

    const csv = [header, ...rows].join("\r\n");
    const filename = `orders_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM for Excel UTF-8
  } catch (err: any) {
    req.log.error({ err }, "admin export orders failed");
    res.status(500).json({ error: "Failed to export" });
  }
});

// ── Bot users CSV export ──────────────────────────────────────────────────────

router.get("/admin/bot-users/export", requireAdmin, async (req, res) => {
  try {
    const users = await db.select().from(botUsersTable).orderBy(desc(botUsersTable.firstSeenAt));

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = ["ID", "Telegram ID", "Username", "Имя", "Фамилия", "С сайта", "Первый визит", "Последний визит"].map(escape).join(",");
    const rows = users.map(u => [
      u.id,
      u.telegramId,
      u.username ?? "",
      u.firstName ?? "",
      u.lastName ?? "",
      u.fromWebsite ? "Да" : "Нет",
      new Date(u.firstSeenAt).toISOString(),
      new Date(u.lastSeenAt).toISOString(),
    ].map(escape).join(","));

    const csv = [header, ...rows].join("\r\n");
    const filename = `bot_users_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv);
  } catch (err: any) {
    req.log.error({ err }, "admin export bot users failed");
    res.status(500).json({ error: "Failed to export" });
  }
});

// ── Prices ───────────────────────────────────────────────────────────────────

const DEFAULT_PRICES = {
  base_price: 5,
  bracelet: { plastic_solid: 0, plastic_segmented: 1, metal_solid: 3, metal_segmented: 4, resin: 2, leather: 3, cotton_fabric: 1 },
  geometry: { circle: 0, square: 1, star: 2, drawn: 3 },
  box: { standard: 0, premium: 5, collector: 15 },
  addon_engraving: 1,
  addon_gift_wrap: 2,
  addon_custom_face: 1,
  addon_skin_full: 1,
  addon_skin_stripe: 1,
};

router.get("/admin/prices", requireAdmin, async (req, res) => {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "component_prices"));
    if (!row) return res.json(DEFAULT_PRICES);
    res.json(JSON.parse(row.value));
  } catch {
    res.json(DEFAULT_PRICES);
  }
});

router.put("/admin/prices", requireAdmin, async (req, res) => {
  try {
    const value = JSON.stringify(req.body);
    await db.insert(settingsTable)
      .values({ key: "component_prices", value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "admin update prices failed");
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
