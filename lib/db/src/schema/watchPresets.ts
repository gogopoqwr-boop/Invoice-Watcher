import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const watchPresetsTable = pgTable("watch_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
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
  boxType: text("box_type").default("standard"),
  boxColor: text("box_color").default("#1A1A1A"),
  priceStars: integer("price_stars").notNull().default(10),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWatchPresetSchema = createInsertSchema(watchPresetsTable).omit({ id: true, createdAt: true });
export type InsertWatchPreset = z.infer<typeof insertWatchPresetSchema>;
export type WatchPreset = typeof watchPresetsTable.$inferSelect;
