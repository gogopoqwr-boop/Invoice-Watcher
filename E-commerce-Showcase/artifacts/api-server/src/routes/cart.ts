import { Router } from "express";
import { db } from "@workspace/db";
import { cartItemsTable, productsTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  GetCartQueryParams,
  AddToCartBody,
  UpdateCartItemBody,
  UpdateCartItemParams,
  RemoveFromCartParams,
  CreateCheckoutTokenBody,
} from "@workspace/api-zod";
import crypto from "crypto";

const router = Router();

async function buildCart(sessionId: string) {
  const items = await db.select().from(cartItemsTable)
    .where(eq(cartItemsTable.sessionId, sessionId));

  const enriched = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(productsTable)
      .where(eq(productsTable.id, item.productId));
    return { ...item, product };
  }));

  const validItems = enriched.filter(i => i.product);
  const totalStars = validItems.reduce((sum, i) => sum + i.product.priceStars * i.quantity, 0);
  const itemCount = validItems.reduce((sum, i) => sum + i.quantity, 0);

  return { items: validItems, totalStars, itemCount };
}

router.get("/cart", async (req, res) => {
  try {
    const parsed = GetCartQueryParams.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "sessionId required" });
    const cart = await buildCart(parsed.data.sessionId);
    res.json(cart);
  } catch (err) {
    req.log.error({ err }, "Failed to get cart");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cart", async (req, res) => {
  try {
    const parsed = AddToCartBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const { sessionId, productId, quantity, selectedColor } = parsed.data;

    // Check if already in cart
    const [existing] = await db.select().from(cartItemsTable)
      .where(and(
        eq(cartItemsTable.sessionId, sessionId),
        eq(cartItemsTable.productId, productId),
        eq(cartItemsTable.selectedColor, selectedColor),
      ));

    if (existing) {
      await db.update(cartItemsTable)
        .set({ quantity: existing.quantity + quantity })
        .where(eq(cartItemsTable.id, existing.id));
    } else {
      await db.insert(cartItemsTable).values({ sessionId, productId, quantity, selectedColor });
    }

    const cart = await buildCart(sessionId);
    res.json(cart);
  } catch (err) {
    req.log.error({ err }, "Failed to add to cart");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/cart/:itemId", async (req, res) => {
  try {
    const params = UpdateCartItemParams.safeParse(req.params);
    const body = UpdateCartItemBody.safeParse(req.body);
    if (!params.success || !body.success) return res.status(400).json({ error: "Invalid input" });
    const [updated] = await db.update(cartItemsTable)
      .set({ quantity: body.data.quantity })
      .where(eq(cartItemsTable.id, params.data.itemId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });

    const [product] = await db.select().from(productsTable)
      .where(eq(productsTable.id, updated.productId));
    res.json({ ...updated, product });
  } catch (err) {
    req.log.error({ err }, "Failed to update cart item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cart/:itemId", async (req, res) => {
  try {
    const parsed = RemoveFromCartParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid itemId" });
    await db.delete(cartItemsTable).where(eq(cartItemsTable.id, parsed.data.itemId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to remove cart item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cart/checkout", async (req, res) => {
  try {
    const parsed = CreateCheckoutTokenBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "sessionId required" });
    const { sessionId } = parsed.data;

    const cart = await buildCart(sessionId);
    if (cart.items.length === 0) return res.status(400).json({ error: "Cart is empty" });

    const token = crypto.randomBytes(16).toString("hex");

    // Create a pending order
    const [order] = await db.insert(ordersTable).values({
      sessionId,
      status: "pending",
      totalStars: cart.totalStars,
      cartToken: token,
    }).returning();

    // Create order items
    await Promise.all(cart.items.map(item =>
      db.insert(orderItemsTable).values({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        selectedColor: item.selectedColor,
        priceStars: item.product.priceStars,
      })
    ));

    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "YourShopBot";
    const telegramLink = `https://t.me/${botUsername}?start=${token}`;

    res.json({ token, telegramLink, totalStars: cart.totalStars });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkout token");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
