const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { sendOtp, verifyOtp } = require("../utils/otp.service");

const pendingUsers = new Map();

const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

// 1️⃣ Register (save to pending, send OTP)
async function register(req, res) {
  try {
    // Only email is used for authentication flow now
    const { fullName, email, password } = req.body;

    if (!fullName || !password || !email)
      return res
        .status(400)
        .json({ message: "fullName, email, and password are required" });

    // Duplicate check (only for email)
    if (await User.findOne({ email }))
      return res.status(409).json({ message: "Email exists" });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const identifier = email; // Email is the primary verification identifier

    // Storing data without the top-level phone field
    pendingUsers.set(identifier, { fullName, email, password: hashed });

    // Send OTP (assumes sendOtp can handle email format)
    sendOtp(identifier, "verify");

    return res.json({
      message: "OTP sent to email, complete verification to register",
    });
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
      return res
        .status(400)
        .json({ message: "identifier (email) and otp required" });

    const result = verifyOtp(identifier, otp);
    if (!result.ok)
      return res
        .status(400)
        .json({ message: "OTP failed", reason: result.reason });

    const pending = pendingUsers.get(identifier);
    if (!pending)
      return res
        .status(400)
        .json({ message: "No pending registration found for this identifier" });

    // User creation: isEmailVerified is true as verification just completed
    const user = await User.create({
      ...pending,
      isEmailVerified: true,
      isPhoneVerified: false, // Since top-level phone is gone, this is set to false by default
    });
    pendingUsers.delete(identifier);

    // 🔐 Generate JWT token (30 days)
    const payload = { id: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
      expiresIn: "30d",
    });

    // Set token in HTTP-only cookie for secure, persistent session (30 days)
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: thirtyDaysInMs,
      sameSite: "lax",
    });

    return res.json({
      message: "Registration complete",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        shippingAddress: user.shippingAddress,
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
    const { email, password } = req.body; // Removed phone from destructuring

    // ✅ Validate input: now requires email
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // ✅ Find user by email only. Explicitly select the password field.
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 🔐 Generate JWT token (30 days)
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );

    // ✅ Set token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
    });

    // ✅ Respond with user data
    res.status(200).json({
      message: "Logged in successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        shippingAddress: user.shippingAddress,
      },
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// 4️⃣ Get current logged-in user
async function getMe(req, res) {
  try {
    // req.user is populated by a middleware which typically fetches the user from DB
    if (!req.user)
      return res.status(401).json({ message: "Authentication required" });

    // Respond with fields present in the schema
    return res.json({
      success: true,
      user: {
        id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email,
        role: req.user.role,
        shippingAddress: req.user.shippingAddress,
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
  });
  return res.json({ message: "Logged out" });
}

// ✅ Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: err.message });
  }
};

// ✅ Get single user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching user", error: err.message });
  }
};

// ✅ Delete user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting user", error: err.message });
  }
};

// ✅ Update user info (role or other)
const updateUser = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).select("-password");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User updated", user: updatedUser });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating user", error: err.message });
  }
};

module.exports = {
  register,
  verifyOtpHandler,
  login,
  logout,
  getMe,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUser,
};
