import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const watchConfigsTable = pgTable("watch_configs", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  presetId: integer("preset_id"),
  watchfaceGeometry: text("watchface_geometry").notNull().default("circle"),
  watchfaceMaterial: text("watchface_material").notNull().default("metal"),
  watchfaceColor: text("watchface_color").notNull().default("#C0C0C0"),
  watchfaceSize: text("watchface_size").default("42mm"),
  braceletMaterial: text("bracelet_material").notNull().default("metal_solid"),
  braceletType: text("bracelet_type").notNull().default("solid"),
  braceletColor: text("bracelet_color").notNull().default("#888888"),
  braceletWidth: text("bracelet_width").default("20mm"),
  braceletLength: text("bracelet_length").default("standard"),
  closingMechanism: text("closing_mechanism").default("buckle"),
  handsStyle: text("hands_style").default("baton"),
  handsColor: text("hands_color").default("#FFFFFF"),
  handsEnabled: boolean("hands_enabled").notNull().default(true),
  serialNumber: text("serial_number"),
  customWatchfaceUrl: text("custom_watchface_url"),
  customBackgroundUrl: text("custom_background_url"),
  skinFullUrl: text("skin_full_url"),
  skinStripeUrl: text("skin_stripe_url"),
  boxType: text("box_type").default("standard"),
  boxColor: text("box_color").default("#1A1A1A"),
  watchfaceText: text("watchface_text"),
  giftWrap: boolean("gift_wrap").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWatchConfigSchema = createInsertSchema(watchConfigsTable).omit({ id: true, createdAt: true });
export type InsertWatchConfig = z.infer<typeof insertWatchConfigSchema>;
export type WatchConfig = typeof watchConfigsTable.$inferSelect;
