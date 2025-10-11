// app.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");

const app = express();

// 🌐 Middlewares
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// 🛣️ Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("✅ API is running...");
});

module.exports = app;
