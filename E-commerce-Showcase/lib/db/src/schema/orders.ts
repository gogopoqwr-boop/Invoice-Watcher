import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | paid | cancelled | refunded
  totalStars: integer("total_stars").notNull(),
  cartToken: text("cart_token"),
  telegramUserId: text("telegram_user_id"),
  telegramPaymentChargeId: text("telegram_payment_charge_id"),
  userEmail: text("user_email"),
  deliveryAddress: text("delivery_address"),
  cancelRequested: boolean("cancel_requested").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  selectedColor: text("selected_color").notNull().default(""),
  priceStars: integer("price_stars").notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
