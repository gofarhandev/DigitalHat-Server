const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/auth.controller");
const { verifyToken, isAdmin } = require("../middlewares/auth.middleware");

router.post("/register", authCtrl.register); // OTP send only
// router.post("/verify-otp", authCtrl.verifyOtpHandler); // OTP verify & DB save
router.post("/login", authCtrl.login); // Login
router.post("/logout", authCtrl.logout);

// Protected route: get current user info
router.get("/me", verifyToken, authCtrl.getMe);

// ✅ Get all users (admin only)
router.get("/all", verifyToken, isAdmin, authCtrl.getAllUsers);

// ✅ Get single user by ID (admin only)
router.get("/user/:id", verifyToken, isAdmin, authCtrl.getUserById);

// ✅ Delete user (admin only)
router.delete("/user/:id", verifyToken, isAdmin, authCtrl.deleteUser);

// ✅ Update user role or info (admin only)
router.put("/user/:id", verifyToken, isAdmin, authCtrl.updateUser);

module.exports = router;
