const mongoose = require("mongoose");

// Review schema
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Ensure your User model name matches
      required: [true, "Review must have a user"],
    },
    rating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
      required: [true, "Rating is required"],
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Product schema
const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    specification: {
      type: mongoose.Schema.Types.Mixed, // Flexible object
      default: {},
    },
    price: {
      amount: {
        type: Number,
        required: [true, "Price amount is required"],
      },
      currency: {
        type: String,
        enum: ["USD", "BDT"],
        default: "BDT",
      },
    },
    images: [
      {
        url: { type: String, required: true },
        thumbnail: { type: String, default: "" },
        id: { type: String, default: "" },
      },
    ],
    category: {
      type: String,
      trim: true,
      default: "",
    },
    stock: {
      type: Number,
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    reviews: [reviewSchema],
    averageRating: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Enable text search on title and description
productSchema.index({ title: "text", description: "text" });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
