const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^(?:\+88|88)?(01[3-9]\d{8})$/.test(v),
        message: "Invalid Bangladeshi phone number",
      },
    },
    division: {
      type: String,
      trim: true,
      validate: (v) =>
        !v ||
        [
          "Dhaka",
          "Chittagong",
          "Khulna",
          "Rajshahi",
          "Barisal",
          "Sylhet",
          "Rangpur",
          "Mymensingh",
        ].includes(v),
    },
    district: { type: String, trim: true },
    thana: { type: String, trim: true },
    postalCode: {
      type: String,
      trim: true,
      validate: (v) => !v || /^\d{4}$/.test(v),
    },
    streetAddress: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      validate: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      validate: (v) => !v || /^(?:\+88|88)?(01[3-9]\d{8})$/.test(v),
    },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    shippingAddress: { type: addressSchema, default: undefined },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre("validate", function (next) {
  if (!this.email && !this.phone)
    return next(
      new Error("Either email or Bangladeshi phone number is required")
    );
  next();
});

module.exports = mongoose.model("User", userSchema);
