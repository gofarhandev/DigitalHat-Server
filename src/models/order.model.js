const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^(?:\+88|88)?(01[3-9]\d{8})$/.test(v),
        message: "Invalid Bangladeshi phone number",
      },
    },
    division: {
      type: String,
      trim: true,
      validate: (v) =>
        !v ||
        [
          "Dhaka",
          "Chittagong",
          "Khulna",
          "Rajshahi",
          "Barisal",
          "Sylhet",
          "Rangpur",
          "Mymensingh",
        ].includes(v),
    },
    district: { type: String, trim: true },
    thana: { type: String, trim: true },
    postalCode: {
      type: String,
      trim: true,
      validate: (v) => !v || /^\d{4}$/.test(v),
    },
    streetAddress: { type: String, trim: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [
        {
          productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
          },
          quantity: {
            type: Number,
            required: true,
            default: 1,
            min: 1,
          },
          price: {
            amount: {
              type: Number,
              required: true,
            },
            currency: {
              type: String,
              required: true,
              enum: ["USD", "BDT"],
            },
          },
        },
      ],
      validate: (v) => Array.isArray(v) && v.length > 0,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "SHIPPED", "DELIVERED"],
      default: "PENDING",
    },
    totalPrice: {
      amount: {
        type: Number,
        required: true,
      },
      currency: {
        type: String,
        required: true,
        enum: ["USD", "BDT"],
      },
    },
    shippingAddress: {
      type: addressSchema,
      required: true,
    },

    // --- COD (Cash On Delivery) only ---
    payment: {
      method: {
        type: String,
        default: "COD",
        enum: ["COD"],
      },
      status: {
        type: String,
        enum: ["PENDING", "COLLECTED"],
        default: "PENDING", // collected after delivery
      },
      collectedAt: { type: Date }, // set when cash is collected
    },

    orderCode: {
      type: String,
      trim: true,
      unique: true,
      index: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

// generate orderCode automatically
orderSchema.pre("save", function (next) {
  if (!this.orderCode) {
    const short = Math.random().toString(36).slice(2, 7).toUpperCase();
    this.orderCode = `ORD${Date.now().toString().slice(-6)}${short}`;
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
