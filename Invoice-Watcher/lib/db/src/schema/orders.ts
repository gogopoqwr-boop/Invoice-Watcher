import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  paymentToken: text("payment_token").unique(),
  configId: integer("config_id").notNull(),
  userEmail: text("user_email"),
  telegramId: text("telegram_id"),
  telegramUsername: text("telegram_username"),
  sessionId: text("session_id"),
  status: text("status").notNull().default("payment_pending"),
  totalStars: integer("total_stars").notNull(),
  cancelComment: text("cancel_comment"),
  refundComment: text("refund_comment"),
  courierId: integer("courier_id"),
  paymentTxId: text("payment_tx_id"),
  telegramPaymentChargeId: text("telegram_payment_charge_id"),
  telegramInvoiceMessageId: integer("telegram_invoice_message_id"),
  duplicateChargeIds: text("duplicate_charge_ids"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
