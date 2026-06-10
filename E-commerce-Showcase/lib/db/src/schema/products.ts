import { pgTable, text, serial, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // phones | laptops | headsets | accessories
  description: text("description"),
  priceStars: integer("price_stars").notNull(),
  imageUrl: text("image_url").notNull(),
  colors: jsonb("colors").notNull().$type<string[]>().default([]),
  selectedColor: text("selected_color").notNull().default(""),
  averageRating: real("average_rating"),
  reviewCount: integer("review_count").notNull().default(0),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
