import { Router } from "express";
import { db, adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_dev_secret_2024";

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.username, username));
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt },
    });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string };
    const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, decoded.id));
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.json({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.get("/couriers", async (req, res) => {
  try {
    const users = await db.select({
      id: adminUsersTable.id,
      username: adminUsersTable.username,
      role: adminUsersTable.role,
      createdAt: adminUsersTable.createdAt,
    }).from(adminUsersTable).where(eq(adminUsersTable.role, "courier"));
    res.json(users);
  } catch (err) {
    req.log.error({ err }, "Failed to list couriers");
    res.status(500).json({ error: "Failed to list couriers" });
  }
});

router.post("/couriers", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(adminUsersTable).values({
      username,
      passwordHash,
      role: "courier",
    }).returning();
    res.status(201).json({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt });
  } catch (err) {
    req.log.error({ err }, "Failed to create courier");
    res.status(500).json({ error: "Failed to create courier" });
  }
});

export default router;
