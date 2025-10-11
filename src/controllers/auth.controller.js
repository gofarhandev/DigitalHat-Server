const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { sendOtp, verifyOtp } = require("../utils/otp.service");

// In-memory store for pending user registrations
const pendingUsers = new Map(); // identifier -> { fullName, email, phone, password }

// Define 30 days in milliseconds for cookie expiration
const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

// 🔐 Helper function — generate token (Set expiration to '30d')
const generateToken = (payload, expiresIn = "30d") => {
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, {
    expiresIn,
  });
};

// 1️⃣ Register (save to pending, send OTP)
async function register(req, res) {
  try {
    const { fullName, email, phone, password } = req.body;
    if (!fullName || !password)
      return res
        .status(400)
        .json({ message: "fullName and password required" });
    if (!email && !phone)
      return res.status(400).json({ message: "Email or phone required" });

    // Duplicate check
    if (email && (await User.findOne({ email })))
      return res.status(409).json({ message: "Email exists" });
    if (phone && (await User.findOne({ phone })))
      return res.status(409).json({ message: "Phone exists" });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const identifier = email || phone;
    pendingUsers.set(identifier, { fullName, email, phone, password: hashed });

    // Send OTP
    sendOtp(identifier, "verify");

    return res.json({ message: "OTP sent, complete verification to register" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

// 2️⃣ Verify OTP & complete registration
async function verifyOtpHandler(req, res) {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp)
      return res.status(400).json({ message: "identifier and otp required" });

    const result = verifyOtp(identifier, otp);
    if (!result.ok)
      return res
        .status(400)
        .json({ message: "OTP failed", reason: result.reason });

    const pending = pendingUsers.get(identifier);
    if (!pending)
      return res.status(400).json({ message: "No pending registration" });

    const user = await User.create({
      ...pending,
      isEmailVerified: !!pending.email,
      isPhoneVerified: !!pending.phone,
    });
    pendingUsers.delete(identifier);

    const payload = { id: user._id, role: user.role };
    const token = generateToken(payload);

    // Set token in HTTP-only cookie for secure, persistent session (30 days)
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: thirtyDaysInMs,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.json({
      message: "Registration complete",
      // Token returned in JSON body for client-side storage (e.g., localStorage),
      // which is needed for Authorization header checks in React.
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

// 3️⃣ Login
async function login(req, res) {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password)
      return res
        .status(400)
        .json({ message: "Email or phone and password are required" });

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const payload = { id: user._id, role: user.role };
    const token = generateToken(payload);

    // Set token in HTTP-only cookie for secure, persistent session (30 days)
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: thirtyDaysInMs,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return res.json({
      message: "Login successful",
      // Token returned in JSON body for client-side storage (e.g., localStorage),
      // which is needed for Authorization header checks in React.
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

// 4️⃣ Get current logged-in user
async function getMe(req, res) {
  try {
    if (!req.user)
      return res.status(401).json({ message: "Authentication required" });

    return res.json({
      success: true,
      user: {
        id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

// 5️⃣ Logout
function logout(req, res) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res.json({ message: "Logged out" });
}

module.exports = { register, verifyOtpHandler, login, logout, getMe };
