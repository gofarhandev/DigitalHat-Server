// controllers/admin.order.controllers.js
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");

/**
 * Helpers
 */
const VALID_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "SHIPPED", "DELIVERED"];

function buildFiltersFromQuery(q = {}) {
  const filters = {};
  if (q.status) filters.status = q.status;
  if (q.user) {
    // allow user id or email
    if (mongoose.Types.ObjectId.isValid(q.user)) filters.user = q.user;
  }
  if (q.orderCode) filters.orderCode = q.orderCode;
  if (q.from || q.to) {
    filters.createdAt = {};
    if (q.from) filters.createdAt.$gte = new Date(q.from);
    if (q.to) filters.createdAt.$lte = new Date(q.to);
  }
  return filters;
}

/**
 * GET /api/admin/orders
 * Query params: page, limit, status, user, orderCode, from, to, sort
 */
async function getAllOrders(req, res) {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.max(parseInt(req.query.limit || "20", 10), 1);
  const skip = (page - 1) * limit;
  const sort = req.query.sort || "-createdAt";

  try {
    const filters = buildFiltersFromQuery(req.query);

    const [orders, totalItems] = await Promise.all([
      Order.find(filters).sort(sort).skip(skip).limit(limit).populate("user", "fullName email"),
      Order.countDocuments(filters),
    ]);

    const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

    return res.status(200).json({
      data: orders,
      meta: { page, limit, totalPages, totalItems },
    });
  } catch (err) {
    console.error("getAllOrders error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * GET /api/admin/orders/:id
 */
async function getOrderByIdAdmin(req, res) {
  const { id } = req.params;

  try {
    const order = await Order.findById(id).populate("user", "fullName email").lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Build basic timeline (you can expand with stored events if you have them)
    const timeline = [
      { status: "CREATED", at: order.createdAt },
      { status: order.status, at: order.updatedAt || order.createdAt },
    ];

    const paymentSummary = {
      method: order.payment?.method || "COD",
      status: order.payment?.status || "PENDING",
      total: order.totalPrice?.amount,
      currency: order.totalPrice?.currency,
      collectedAt: order.payment?.collectedAt || null,
    };

    return res.status(200).json({ order, timeline, paymentSummary });
  } catch (err) {
    console.error("getOrderByIdAdmin error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * PATCH /api/admin/orders/:id/status
 * Body: { status: "CONFIRMED" }
 */
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` });
  }

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // if already same status
    if (order.status === status) {
      return res.status(200).json({ message: "Status unchanged", order });
    }

    // handle transitions: if cancelling here, restock items
    if (status === "CANCELLED" && !["CANCELLED"].includes(order.status)) {
      order.status = "CANCELLED";
      await order.save();

      // restock items (best-effort)
      for (const it of order.items) {
        try {
          await Product.findByIdAndUpdate(it.productId, { $inc: { stock: it.quantity } });
        } catch (err) {
          console.warn(`Failed to restock product ${it.productId}:`, err?.message || err);
        }
      }

      return res.status(200).json({ message: "Order cancelled by admin", order });
    }

    // for other statuses just update
    order.status = status;
    await order.save();

    return res.status(200).json({ message: "Order status updated", order });
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * PATCH /api/admin/orders/:id/payment/collect
 * Mark COD as collected by courier/admin
 */
async function markCodCollected(req, res) {
  const { id } = req.params;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Only COD orders supported
    if (!order.payment || order.payment.method !== "COD") {
      return res.status(400).json({ message: "Order is not COD" });
    }

    order.payment.status = "COLLECTED";
    order.payment.collectedAt = new Date();

    await order.save();
    return res.status(200).json({ message: "COD marked as collected", order });
  } catch (err) {
    console.error("markCodCollected error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * PATCH /api/admin/orders/:id/address
 * Body: { shippingAddress: { ... } }
 */
async function updateOrderAddressAdmin(req, res) {
  const { id } = req.params;
  const newAddr = req.body.shippingAddress;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // update address fields (no strict validation here; mongoose will validate on save)
    order.shippingAddress = {
      fullName: newAddr?.fullName || order.shippingAddress?.fullName,
      phone: newAddr?.phone || order.shippingAddress?.phone,
      division: newAddr?.division || order.shippingAddress?.division,
      district: newAddr?.district || order.shippingAddress?.district,
      thana: newAddr?.thana || order.shippingAddress?.thana,
      postalCode: newAddr?.postalCode || order.shippingAddress?.postalCode,
      streetAddress: newAddr?.streetAddress || order.shippingAddress?.streetAddress,
    };

    await order.save();
    return res.status(200).json({ message: "Order address updated", order });
  } catch (err) {
    console.error("updateOrderAddressAdmin error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * POST /api/admin/orders/:id/cancel
 * Admin-initiated cancel (force). Restocks items (best-effort).
 * Body optional: { reason: "..." }
 */
async function cancelOrderByAdmin(req, res) {
  const { id } = req.params;

  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "CANCELLED") {
      return res.status(409).json({ message: "Order already cancelled" });
    }

    order.status = "CANCELLED";
    await order.save();

    // restock items (best-effort)
    for (const it of order.items) {
      try {
        await Product.findByIdAndUpdate(it.productId, { $inc: { stock: it.quantity } });
      } catch (err) {
        console.warn(`Failed to restock product ${it.productId}:`, err?.message || err);
      }
    }

    return res.status(200).json({ message: "Order cancelled by admin", order });
  } catch (err) {
    console.error("cancelOrderByAdmin error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * DELETE /api/admin/orders/:id
 * Hard delete (use with caution)
 */
async function deleteOrderByAdmin(req, res) {
  const { id } = req.params;

  try {
    const order = await Order.findByIdAndDelete(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.status(200).json({ message: "Order deleted", order });
  } catch (err) {
    console.error("deleteOrderByAdmin error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * GET /api/admin/orders/export
 * Exports filtered orders as CSV
 * Query params same as getAllOrders filters
 */
async function exportOrders(req, res) {
  try {
    const filters = buildFiltersFromQuery(req.query);
    const orders = await Order.find(filters).sort({ createdAt: -1 }).populate("user", "fullName email").lean();

    // CSV header
    const header = [
      "orderId",
      "orderCode",
      "userId",
      "userName",
      "userEmail",
      "status",
      "totalAmount",
      "currency",
      "paymentStatus",
      "createdAt",
      "shippingFullName",
      "shippingPhone",
      "shippingDivision",
      "shippingDistrict",
      "shippingThana",
      "shippingPostalCode",
      "shippingStreetAddress",
    ];

    const rows = orders.map((o) => {
      return [
        String(o._id),
        o.orderCode || "",
        String(o.user?._id || ""),
        o.user?.fullName || "",
        o.user?.email || "",
        o.status || "",
        o.totalPrice?.amount ?? "",
        o.totalPrice?.currency ?? "",
        o.payment?.status ?? "",
        o.createdAt ? new Date(o.createdAt).toISOString() : "",
        o.shippingAddress?.fullName ?? "",
        o.shippingAddress?.phone ?? "",
        o.shippingAddress?.division ?? "",
        o.shippingAddress?.district ?? "",
        o.shippingAddress?.thana ?? "",
        o.shippingAddress?.postalCode ?? "",
        o.shippingAddress?.streetAddress ?? "",
      ]
        .map((cell) => {
          // Escape double quotes
          if (cell === null || cell === undefined) return "";
          const s = String(cell);
          if (s.includes('"') || s.includes(",") || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",");
    });

    const csvContent = [header.join(","), ...rows].join("\n");

    const filename = `orders_export_${Date.now()}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error("exportOrders error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getAllOrders,
  getOrderByIdAdmin,
  updateOrderStatus,
  markCodCollected,
  updateOrderAddressAdmin,
  cancelOrderByAdmin,
  deleteOrderByAdmin,
  exportOrders,
};
