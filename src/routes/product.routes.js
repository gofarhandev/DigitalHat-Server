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
  upload.array("images", 5), // up to 5 images under form-field name "images"
  productCtrl.createProduct
);

// Allow updating product data and optionally new images
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  upload.array("images", 5), // include if you want to accept new images on update
  productCtrl.updateProduct
);

router.delete("/:id", verifyToken, isAdmin, productCtrl.deleteProduct);

// ----- Authenticated user routes (reviews) & public product routes -----
router.post("/:id/reviews", verifyToken, productCtrl.addReview);
router.get("/", productCtrl.getProducts);
router.get("/:id", productCtrl.getProductById);

module.exports = router;
