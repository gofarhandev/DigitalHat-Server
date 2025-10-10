const express = require("express");
const router = express.Router();
const multer = require("multer");

const { verifyToken, isAdmin } = require("../middlewares/auth.middleware");
const productCtrl = require("../controllers/product.controller");

// Multer memory storage (we upload buffers to ImageKit)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ----- Admin-only routes -----
router.post(
  "/",
  verifyToken,
  isAdmin,
  upload.array("images", 5),
  productCtrl.createProduct
);

// Allow updating product data and optionally new images
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  upload.array("images", 5),
  productCtrl.updateProduct
);

// Get products by category
router.get("/category/:categoryName", productCtrl.getProductsByCategory);

router.delete("/:id", verifyToken, isAdmin, productCtrl.deleteProduct);

// ----- Authenticated user routes (reviews) & public product routes -----
router.get("/", productCtrl.getProducts);
router.get("/:id", productCtrl.getProductById);

// ✅ Get all reviews for a specific product
router.get("/:productId/reviews", productCtrl.getReviews);
router.post("/:id/reviews", verifyToken, productCtrl.addReview);

module.exports = router;
