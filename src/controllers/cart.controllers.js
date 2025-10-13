const mongoose = require("mongoose");
const Cart = require("../models/cart.model");

async function getCurrentCart(req, res) {
  const user = req.user;

  try {
    let cart = await Cart.findOne({ user: user.id });

    if (!cart) {
      cart = new Cart({ user: user.id, items: [] });
      await cart.save();
    }

    const itemCount = Array.isArray(cart.items) ? cart.items.length : 0;
    const totalQuantity = Array.isArray(cart.items)
      ? cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      : 0;

    return res.status(200).json({
      message: "Cart fetched",
      cart,
      total: {
        itemCount,
        totalQuantity,
      },
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
      return res
        .status(400)
        .json({ message: "productId and quantity required" });
    }

    let cart = await Cart.findOne({ user: user.id });
    if (!cart) {
      cart = await Cart.create({ user: user.id, items: [] });
    }

    // Convert productId safely to ObjectId
    const prodId = new mongoose.Types.ObjectId(productId);

    const existingItemIndex = cart.items.findIndex(
      (item) => String(item.productId) === String(prodId)
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += Number(quantity);
    } else {
      cart.items.push({ productId: prodId, quantity: Number(quantity) });
    }

    await cart.save();

    return res.status(200).json({
      message: "Item added to cart successfully",
      cart,
    });
  } catch (err) {
    console.error("addItemToCart:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
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

    const cart = await Cart.findOne({ user: user.id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const idx = cart.items.findIndex(
      (i) => String(i.productId) === String(productId)
    );
    if (idx === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (qty === 0) {
      // remove item
      cart.items.splice(idx, 1);
    } else if (qty === undefined) {
      // if no quantity provided, return current item
      return res
        .status(200)
        .json({ message: "No quantity provided", item: cart.items[idx] });
    } else {
      // set new quantity (integer)
      cart.items[idx].quantity = Math.floor(qty);
    }

    await cart.save();

    return res.status(200).json({ message: "Cart updated", cart });
  } catch (err) {
    console.error("updateItemQuantity:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function removeItemFromCart(req, res) {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const prodId = new mongoose.Types.ObjectId(productId);
    const initialLength = cart.items.length;

    // Remove the product from the cart
    cart.items = cart.items.filter(
      (item) => String(item.productId) !== String(prodId)
    );

    if (cart.items.length === initialLength) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    await cart.save();

    return res.status(200).json({
      message: "Item removed from cart successfully",
      cart,
    });
  } catch (error) {
    console.error("removeItemFromCart:", error);
    res.status(500).json({
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
