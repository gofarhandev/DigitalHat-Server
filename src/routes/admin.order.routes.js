const express = require("express");
const orderController = require("../controllers/admin.order.controllers");
const { verifyToken, isAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

// GET /api/admin/orders
router.get("/", verifyToken, isAdmin, orderController.getAllOrders);

// (Optional) Export orders CSV/Excel (filtered)
// GET /api/admin/orders/export
router.get("/export", verifyToken, isAdmin, orderController.exportOrders);

// GET /api/admin/orders/:id
router.get("/:id", verifyToken, isAdmin, orderController.getOrderByIdAdmin);

// Update order status (e.g., CONFIRMED, SHIPPED, DELIVERED, CANCELLED)
// PATCH /api/admin/orders/:id/status
router.patch(
  "/:id/status",
  verifyToken,
  isAdmin,
  orderController.updateOrderStatus
);

// Mark COD as collected (admin/courier confirms cash collection)
// PATCH /api/admin/orders/:id/payment/collect
router.patch(
  "/:id/payment/collect",
  verifyToken,
  isAdmin,
  orderController.markCodCollected
);

// Update shipping info (address or courier details) as admin
// PATCH /api/admin/orders/:id/address
router.patch(
  "/:id/address",
  verifyToken,
  isAdmin,
  orderController.updateOrderAddressAdmin
);

// Cancel order as admin (force cancel, refund/process note if any)
// POST /api/admin/orders/:id/cancel
router.post(
  "/:id/cancel",
  verifyToken,
  isAdmin,
  orderController.cancelOrderByAdmin
);

// Delete order (hard delete) — use with caution
// DELETE /api/admin/orders/:id
router.delete("/:id", verifyToken, isAdmin, orderController.deleteOrderByAdmin);

module.exports = router;
