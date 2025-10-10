const Product = require("../models/product.model");
const { uploadImage } = require("../utils/imagekit.service");
const User = require("../models/user.model");

// Helper to safely parse JSON strings
const safeParseJSON = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
};

// --------- PRODUCT CONTROLLERS ---------

// Create Product
exports.createProduct = async (req, res) => {
  try {
    // form-data text fields (strings)
    const {
      title,
      description = "",
      specification, // may be JSON string or object
      category = "",
      stock,
      price, // may be JSON string
      price_amount,
      price_currency,
    } = req.body;

    // Basic validation
    if (!title)
      return res
        .status(400)
        .json({ success: false, message: "Title is required" });

    // Parse specification (prefer JSON string or object). If invalid JSON => error.
    let parsedSpec = {};
    if (specification) {
      const maybeSpec = safeParseJSON(specification);
      if (maybeSpec === null) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid specification JSON" });
      }
      parsedSpec = maybeSpec;
    }

    // Parse price
    let parsedPrice = null;
    if (price) {
      const maybePrice = safeParseJSON(price);
      if (maybePrice === null) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid price JSON" });
      }
      parsedPrice = maybePrice;
    } else if (price_amount) {
      parsedPrice = {
        amount: Number(price_amount),
        currency: price_currency || "BDT",
      };
    }

    if (
      !parsedPrice ||
      parsedPrice.amount === undefined ||
      parsedPrice.amount === null ||
      Number.isNaN(Number(parsedPrice.amount))
    ) {
      return res.status(400).json({
        success: false,
        message: "price.amount is required and must be a number",
      });
    }

    // Parse stock
    const parsedStock = stock !== undefined ? Number(stock) : 0;
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({
        success: false,
        message: "stock must be a non-negative number",
      });
    }

    // Upload images (if any)
    let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const img = await uploadImage(file); // expects { url, thumbnail, id } or similar
        images.push({
          url: img.url,
          thumbnail: img.thumbnail || img.thumbnailUrl || "",
          id: img.id || img.fileId || img.fileId,
        });
      }
    }

    // Create product
    const product = await Product.create({
      title: title.trim(),
      description: description.trim(),
      specification: parsedSpec,
      price: {
        amount: Number(parsedPrice.amount),
        currency: parsedPrice.currency || "BDT",
      },
      category: category.trim(),
      stock: parsedStock,
      images,
    });

    return res.status(201).json({ success: true, product });
  } catch (error) {
    console.error("Product creation failed:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const rawCategory = req.params.categoryName; // e.g. "tws-earbuds"

    // Convert hyphenated lowercase to proper category format
    const category = rawCategory
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // Use MongoDB regex for case-insensitive search in title/description
    const products = await Product.find({
      $or: [
        { category: category }, // exact category match
        { title: { $regex: category, $options: "i" } }, // title contains keyword
        { description: { $regex: category, $options: "i" } }, // description contains keyword
      ],
    });

    if (!products.length) {
      return res
        .status(404)
        .json({ message: "No products found in this category or keyword" });
    }

    res.status(200).json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;
    let filter = {};

    if (category) filter.category = category;
    if (search) filter.$text = { $search: search };

    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.json({ success: true, total, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single product
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update product (admin)
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    // Accept same fields as create (form-data)
    const {
      title,
      description,
      specification, // may replace the whole specification object
      category,
      stock,
      sold, // ✅ new field added
      price, // JSON string OR
      price_amount,
      price_currency,
      removeImageIds, // optional: comma separated ids to remove from product.images
    } = req.body;

    // update simple fields if provided
    if (title !== undefined) product.title = title.trim();
    if (description !== undefined) product.description = description.trim();
    if (category !== undefined) product.category = category.trim();

    // specification: replace if provided (expects JSON string or object)
    if (specification !== undefined) {
      const maybeSpec = safeParseJSON(specification);
      if (maybeSpec === null) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid specification JSON" });
      }
      product.specification = maybeSpec;
    }

    // price handling
    let parsedPrice = null;
    if (price) {
      const maybePrice = safeParseJSON(price);
      if (maybePrice === null) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid price JSON" });
      }
      parsedPrice = maybePrice;
    } else if (price_amount) {
      parsedPrice = {
        amount: Number(price_amount),
        currency: price_currency || product.price.currency || "BDT",
      };
    }

    if (parsedPrice) {
      if (
        parsedPrice.amount === undefined ||
        parsedPrice.amount === null ||
        Number.isNaN(Number(parsedPrice.amount))
      ) {
        return res
          .status(400)
          .json({ success: false, message: "price.amount must be a number" });
      }
      product.price = {
        amount: Number(parsedPrice.amount),
        currency: parsedPrice.currency || product.price.currency || "BDT",
      };
    }

    // stock update
    if (stock !== undefined) {
      const parsedStock = Number(stock);
      if (Number.isNaN(parsedStock) || parsedStock < 0) {
        return res.status(400).json({
          success: false,
          message: "stock must be a non-negative number",
        });
      }
      product.stock = parsedStock;
    }

    // ✅ sold update
    if (sold !== undefined) {
      const parsedSold = Number(sold);
      if (Number.isNaN(parsedSold) || parsedSold < 0) {
        return res.status(400).json({
          success: false,
          message: "sold must be a non-negative number",
        });
      }
      product.sold = parsedSold;
    }

    // remove images if provided (optional)
    if (removeImageIds) {
      const idsToRemove = String(removeImageIds)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (idsToRemove.length > 0) {
        product.images = product.images.filter(
          (img) => !idsToRemove.includes(String(img.id))
        );
      }
    }

    // upload new images (if any) and append
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const img = await uploadImage(file);
        product.images.push({
          url: img.url,
          thumbnail: img.thumbnail || img.thumbnailUrl || "",
          id: img.id || img.fileId || img.fileId,
        });
      }
    }

    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    console.error("Product update failed:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    // optionally delete product.images from ImageKit here
    res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --------- REVIEW CONTROLLERS ---------

// Add review
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    // Ensure reviews array exists
    product.reviews = product.reviews || [];

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      (r) => r.userId?.toString() === req.user._id.toString()
    );
    if (alreadyReviewed)
      return res
        .status(400)
        .json({ success: false, message: "Product already reviewed by you" });

    // Get user info
    const user = await User.findById(req.user._id).select(
      "fullName email phone"
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Create review
    const review = {
      userId: req.user._id,
      user: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
      rating: Number(rating),
      comment,
    };

    product.reviews.push(review);

    // Update stats
    product.reviewCount = product.reviews.length;
    product.averageRating =
      product.reviews.reduce((acc, r) => acc + r.rating, 0) /
      product.reviews.length;

    await product.save();
    res.status(201).json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all reviews
exports.getReviews = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId).select(
      "reviews"
    );
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    // Only return user info that is already saved in review
    const reviews = product.reviews.map((r) => ({
      _id: r._id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: r.user, // fullName + email/phone
    }));

    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
