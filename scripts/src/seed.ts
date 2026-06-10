import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import * as schema from "../../lib/db/src/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const PRESETS = [
  {
    name: "Midnight Steel",
    description: "Брутальная нержавейка, тёмный циферблат",
    watchfaceGeometry: "circle",
    watchfaceMaterial: "metal",
    watchfaceColor: "#0f172a",
    braceletMaterial: "metal_solid",
    braceletType: "solid",
    braceletColor: "#1e293b",
    handsEnabled: true,
    handsColor: "#cbd5e1",
    priceStars: 15,
  },
  {
    name: "Arctic Frost",
    description: "Белоснежная керамика, полярная чистота",
    watchfaceGeometry: "circle",
    watchfaceMaterial: "plastic",
    watchfaceColor: "#f8fafc",
    braceletMaterial: "plastic_solid",
    braceletType: "solid",
    braceletColor: "#e2e8f0",
    handsEnabled: true,
    handsColor: "#0f172a",
    priceStars: 12,
  },
  {
    name: "Crimson Core",
    description: "Алый акцент, стальной корпус",
    watchfaceGeometry: "circle",
    watchfaceMaterial: "metal",
    watchfaceColor: "#7f1d1d",
    braceletMaterial: "leather",
    braceletType: "solid",
    braceletColor: "#1c1917",
    handsEnabled: true,
    handsColor: "#fbbf24",
    priceStars: 18,
  },
  {
    name: "Carbon Ghost",
    description: "Угольный карбон, невидимость в темноте",
    watchfaceGeometry: "square",
    watchfaceMaterial: "plastic",
    watchfaceColor: "#0a0a0a",
    braceletMaterial: "resin",
    braceletType: "solid",
    braceletColor: "#171717",
    handsEnabled: false,
    handsColor: "#ffffff",
    priceStars: 20,
  },
  {
    name: "Gold Rush",
    description: "Роскошное золото, классика вне времени",
    watchfaceGeometry: "drawn",
    watchfaceMaterial: "metal",
    watchfaceColor: "#78350f",
    braceletMaterial: "metal_segmented",
    braceletType: "segmented",
    braceletColor: "#b8860b",
    handsEnabled: true,
    handsColor: "#fbbf24",
    priceStars: 25,
  },
  {
    name: "Ocean Drive",
    description: "Морская синева, дух свободы",
    watchfaceGeometry: "circle",
    watchfaceMaterial: "plastic",
    watchfaceColor: "#1e3a5f",
    braceletMaterial: "cotton_fabric",
    braceletType: "solid",
    braceletColor: "#1e40af",
    handsEnabled: true,
    handsColor: "#60a5fa",
    priceStars: 14,
  },
];

const ADMIN_USERS = [
  { username: "admin", password: "FutureAfterWatch3s", role: "admin" },
  { username: "courier1", password: "courier123", role: "courier" },
];

async function seed() {
  console.log("🌱 Seeding database...");

  // Seed presets
  console.log("  → Inserting presets...");
  for (const preset of PRESETS) {
    try {
      await db.insert(schema.watchPresetsTable).values(preset).onConflictDoNothing();
    } catch (err) {
      console.error(`    ✗ Failed to insert preset "${preset.name}":`, err);
    }
  }
  console.log(`  ✓ ${PRESETS.length} presets seeded`);

  // Seed admin users
  console.log("  → Inserting admin users...");
  for (const user of ADMIN_USERS) {
    try {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await db.insert(schema.adminUsersTable)
        .values({ username: user.username, passwordHash, role: user.role })
        .onConflictDoNothing();
    } catch (err) {
      console.error(`    ✗ Failed to insert user "${user.username}":`, err);
    }
  }
  console.log(`  ✓ ${ADMIN_USERS.length} admin users seeded`);

  console.log("✅ Seeding complete!");
  await pool.end();
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
