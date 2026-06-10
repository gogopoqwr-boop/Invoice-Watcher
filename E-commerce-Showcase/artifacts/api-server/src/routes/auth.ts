import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const router = Router();

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

router.post("/auth/register", async (req, res) => {
  try {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const { email, password, name } = parsed.data;

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const authToken = generateToken();

    const [user] = await db.insert(usersTable).values({
      email,
      passwordHash,
      name: name ?? email.split("@")[0],
      authToken,
    }).returning();

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      deliveryAddress: user.deliveryAddress,
      token: authToken,
    });
  } catch (err) {
    req.log.error({ err }, "Register failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const { email, password } = parsed.data;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid email or password" });

    const authToken = generateToken();
    await db.update(usersTable).set({ authToken }).where(eq(usersTable.id, user.id));

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      deliveryAddress: user.deliveryAddress,
      token: authToken,
    });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      await db.update(usersTable).set({ authToken: null }).where(eq(usersTable.authToken, token));
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Logout failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.authToken, token));
    if (!user) return res.status(401).json({ error: "Invalid token" });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      deliveryAddress: user.deliveryAddress,
    });
  } catch (err) {
    req.log.error({ err }, "Auth me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/auth/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.authToken, token));
    if (!user) return res.status(401).json({ error: "Invalid token" });

    const UpdateBody = z.object({
      name: z.string().optional(),
      deliveryAddress: z.string().optional(),
    });
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [updated] = await db.update(usersTable)
      .set(parsed.data)
      .where(eq(usersTable.id, user.id))
      .returning();

    res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      isAdmin: updated.isAdmin,
      deliveryAddress: updated.deliveryAddress,
    });
  } catch (err) {
    req.log.error({ err }, "Update profile failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
