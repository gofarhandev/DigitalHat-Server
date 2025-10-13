// controllers/user.order.controllers.js
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const User = require("../models/user.model");
const Product = require("../models/product.model");

async function createOrder(req, res) {
  const user = req.user;
  const shippingAddress = req.body?.shippingAddress || user.shippingAddress;

  if (!shippingAddress) {
    return res.status(400).json({
      message:
        "shippingAddress is required in request body or user must have a saved shippingAddress.",
    });
  }

  // proceed to create order with shippingAddress
  const cart = await Cart.findOne({ user: user.id }).lean();
  if (!cart || cart.items.length === 0)
    return res.status(400).json({ message: "Cart is empty" });

  let totalAmount = 0;
  const orderItems = [];

  for (const item of cart.items) {
    const product = await Product.findById(item.productId).lean();
    if (!product)
      return res
        .status(400)
        .json({ message: `Product ${item.productId} not found` });
    if (product.stock < item.quantity) {
      return res
        .status(409)
        .json({ message: `Product ${product._id} out of stock` });
    }

    const itemTotal = (product.price?.amount || 0) * item.quantity;
    totalAmount += itemTotal;

    orderItems.push({
      productId: product._id,
      quantity: item.quantity,
      price: { amount: itemTotal, currency: product.price?.currency || "BDT" },
    });
  }

  const order = await Order.create({
    user: user.id,
    items: orderItems,
    totalPrice: { amount: totalAmount, currency: "BDT" },
    shippingAddress,
    status: "PENDING",
    payment: { method: "COD", status: "PENDING" },
  });

  return res.status(201).json({ order });
}

async function getOrderById(req, res) {
  const user = req.user;
  const { id: orderId } = req.params;

  try {
    const order = await Order.findOne({ _id: orderId, user: user.id }).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

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
    console.error("getOrderById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function getMyOrders(req, res) {
  const user = req.user;
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.max(parseInt(req.query.limit || "10", 10), 1);
  const skip = (page - 1) * limit;

  try {
    const [orders, totalItems] = await Promise.all([
      Order.find({ user: user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ user: user.id }),
    ]);

    const totalPages = Math.max(Math.ceil(totalItems / limit), 1);
    return res.status(200).json({
      data: orders,
      meta: { page, limit, totalPages, totalItems },
    });
  } catch (err) {
    console.error("getMyOrders error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function cancelOrderById(req, res) {
  const user = req.user;
  const { id: orderId } = req.params;

  try {
    const order = await Order.findOne({ _id: orderId, user: user.id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "CANCELLED") {
      return res.status(409).json({ message: "Order already cancelled" });
    }

    const cancelable = ["PENDING", "CONFIRMED"];
    if (!cancelable.includes(order.status)) {
      return res
        .status(409)
        .json({ message: "Order not cancelable at this stage" });
    }

    order.status = "CANCELLED";
    order.payment = order.payment || {};
    // for COD there is nothing to refund; mark payment as still PENDING or keep as is
    await order.save();

    // restock items (best-effort)
    for (const it of order.items) {
      try {
        await Product.findByIdAndUpdate(it.productId, {
          $inc: { stock: it.quantity },
        });
      } catch (err) {
        console.warn(
          `Failed to restock product ${it.productId}:`,
          err?.message || err
        );
      }
    }

    return res.status(200).json({ message: "Order cancelled", order });
  } catch (err) {
    console.error("cancelOrderById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function updateOrderAddress(req, res) {
  const user = req.user;
  const { id: orderId } = req.params;
  const newAddr = req.body.shippingAddress;

  try {
    const order = await Order.findOne({ _id: orderId, user: user.id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const updatable = ["PENDING", "CONFIRMED"];
    if (!updatable.includes(order.status)) {
      return res
        .status(409)
        .json({ message: "Order address cannot be updated at this stage" });
    }

    // Map incoming fields to addressSchema shape
    order.shippingAddress = {
      fullName: newAddr?.fullName || order.shippingAddress?.fullName,
      phone: newAddr?.phone || order.shippingAddress?.phone,
      division: newAddr?.division || order.shippingAddress?.division,
      district: newAddr?.district || order.shippingAddress?.district,
      thana: newAddr?.thana || order.shippingAddress?.thana,
      postalCode: newAddr?.postalCode || order.shippingAddress?.postalCode,
      streetAddress:
        newAddr?.streetAddress || order.shippingAddress?.streetAddress,
    };

    await order.save();
    return res.status(200).json({ message: "Address updated", order });
  } catch (err) {
    console.error("updateOrderAddress error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  createOrder,
  getOrderById,
  getMyOrders,
  cancelOrderById,
  updateOrderAddress,
};
