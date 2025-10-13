const express = require("express");
const orderController = require("../controllers/user.order.controllers");
const { verifyToken, isUser, isAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

// POST /api/orders
router.post("/", verifyToken, isUser, orderController.createOrder);

// GET /api/orders/me
router.get("/me", verifyToken, isUser, orderController.getMyOrders);

// GET /api/orders/:id
router.get("/:id", verifyToken, isUser, orderController.getOrderById);

// POST /api/orders/:id/cancel
router.post(
  "/:id/cancel",
  verifyToken,
  isUser,
  orderController.cancelOrderById
);

// PATCH /api/orders/:id/address
router.patch(
  "/:id/address",
  verifyToken,
  isUser,
  orderController.updateOrderAddress
);

module.exports = router;
