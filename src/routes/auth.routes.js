const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.post("/register", authCtrl.register); // OTP send only
router.post("/verify-otp", authCtrl.verifyOtpHandler); // OTP verify & DB save
router.post("/login", authCtrl.login); // Login
router.post("/logout", authCtrl.logout);

// Protected route: get current user info
router.get("/me", verifyToken, authCtrl.getMe);

module.exports = router;
