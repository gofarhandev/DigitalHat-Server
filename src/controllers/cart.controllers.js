// controllers/cart.controllers.js
const mongoose = require("mongoose");
const Cart = require("../models/cart.model");

async function getCurrentCart(req, res) {
  const user = req.user;
  try {
    // ensure cart exists and return it (atomic upsert)
    const cart = await Cart.findOneAndUpdate(
      { user: user.id },
      { $setOnInsert: { user: user.id, items: [] } },
      { new: true, upsert: true }
    ).lean();

    const itemCount = Array.isArray(cart.items) ? cart.items.length : 0;
    const totalQuantity = Array.isArray(cart.items)
      ? cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      : 0;

    return res.status(200).json({
      message: "Cart fetched",
      cart,
      total: { itemCount, totalQuantity },
    });
  } catch (err) {
    console.error("getCurrentCart:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function addItemToCart(req, res) {
  try {
    const { productId, quantity } = req.body;
    const user = req.user;

    if (!productId || !quantity) {
      return res.status(400).json({ message: "productId and quantity required" });
    }
    if (!mongoose.Types.ObjectId.isValid(String(productId))) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const prodId = new mongoose.Types.ObjectId(productId);
    const qty = Number(quantity) || 0;
    if (qty <= 0) return res.status(400).json({ message: "Quantity must be > 0" });

    const filterHasItem = { user: user.id, "items.productId": prodId };
    const incResult = await Cart.findOneAndUpdate(
      filterHasItem,
      { $inc: { "items.$.quantity": qty } },
      { new: true }
    ).lean();

    if (incResult) {
      // item existed and was incremented
      return res.status(200).json({
        message: "Item quantity incremented",
        cart: incResult,
      });
    }

    // item didn't exist — push atomically, create cart if missing
    const pushed = await Cart.findOneAndUpdate(
      { user: user.id },
      { $push: { items: { productId: prodId, quantity: qty } }, $setOnInsert: { user: user.id } },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({
      message: "Item added to cart successfully",
      cart: pushed,
    });
  } catch (err) {
    console.error("addToCart:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}

async function updateItemQuantity(req, res) {
  try {
    const productId = req.params.productId;
    const { quantity } = req.body;
    const user = req.user;

    if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) {
      return res.status(400).json({ message: "Invalid productId parameter" });
    }

    const qty = quantity !== undefined ? Number(quantity) : undefined;
    if (qty !== undefined && (Number.isNaN(qty) || qty < 0)) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const prodId = new mongoose.Types.ObjectId(productId);

    // If qty === undefined -> just return current item
    if (qty === undefined) {
      const cart = await Cart.findOne({ user: user.id }).lean();
      if (!cart) return res.status(404).json({ message: "Cart not found" });
      const item = (cart.items || []).find((i) => String(i.productId) === String(prodId));
      if (!item) return res.status(404).json({ message: "Item not found in cart" });
      return res.status(200).json({ message: "Item found", item });
    }

    // If qty === 0 -> remove item via $pull
    if (qty === 0) {
      const updated = await Cart.findOneAndUpdate(
        { user: user.id },
        { $pull: { items: { productId: prodId } } },
        { new: true }
      ).lean();

      if (!updated) return res.status(404).json({ message: "Cart not found" });

      return res.status(200).json({ message: "Item removed", cart: updated });
    }

    // Else set new quantity using arrayFilters (atomic)
    const updated = await Cart.findOneAndUpdate(
      { user: user.id, "items.productId": prodId },
      { $set: { "items.$[elem].quantity": Math.floor(qty) } },
      { new: true, arrayFilters: [{ "elem.productId": prodId }] }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    return res.status(200).json({ message: "Cart updated", cart: updated });
  } catch (err) {
    console.error("updateItemQuantity:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function removeItemFromCart(req, res) {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) {
      return res.status(400).json({ message: "Invalid productId parameter" });
    }
    const prodId = new mongoose.Types.ObjectId(productId);

    // atomic pull
    const updatedCart = await Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { productId: prodId } } },
      { new: true }
    ).lean();

    if (!updatedCart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    return res.status(200).json({
      message: "Item removed from cart successfully",
      cart: updatedCart,
    });
  } catch (error) {
    console.error("removeItemFromCart:", error);
    return res.status(500).json({
      message: "Server error while removing item from cart",
      error: error.message,
    });
  }
}

module.exports = {
  addItemToCart,
  updateItemQuantity,
  getCurrentCart,
  removeItemFromCart,
};
