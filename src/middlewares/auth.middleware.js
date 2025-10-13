const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

// ----- 1️⃣ Verify Token Middleware -----
const verifyToken = async (req, res, next) => {
  let token;

  // 1) Try header: "Authorization: Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }
  // 2) Fallback to cookie named "token"
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  try {
    // Verify using the secret key you store in env: JWT_SECRET_KEY
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // Attach user to request (exclude password)
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    // More descriptive error for debugging; keep client message generic
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ message: "Token invalid or expired" });
  }
};

// ----- 2️⃣ Admin Check Middleware -----
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// ----- 2️⃣ User Check Middleware -----
const isUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.user.role !== "user") {
    return res.status(403).json({ message: "User access required" });
  }
  next();
};

module.exports = { verifyToken, isAdmin, isUser };
