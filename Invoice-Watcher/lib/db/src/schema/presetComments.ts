import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const presetCommentsTable = pgTable("preset_comments", {
  id: serial("id").primaryKey(),
  presetId: integer("preset_id").notNull(),
  authorName: text("author_name").notNull().default("Аноним"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PresetComment = typeof presetCommentsTable.$inferSelect;
