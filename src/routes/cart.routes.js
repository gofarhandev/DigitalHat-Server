const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cart.controllers");
const { verifyToken, isUser } = require("../middlewares/auth.middleware");

// GET current cart
router.get("/", verifyToken, isUser, cartController.getCurrentCart);

// POST add item to cart
router.post("/items", verifyToken, isUser, cartController.addItemToCart);

// PATCH update item quantity
router.patch(
  "/items/:productId",
  verifyToken,
  isUser,
  cartController.updateItemQuantity
);

// 🗑️ DELETE remove item from cart
router.delete(
  "/items/:productId",
  verifyToken,
  isUser,
  cartController.removeItemFromCart
);

module.exports = router;
