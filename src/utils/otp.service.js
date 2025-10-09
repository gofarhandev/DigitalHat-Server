const { sendEmail } = require("./email.service");

const otpStore = new Map(); // dev-only in-memory store

function generateOtp(length = Number(process.env.OTP_LENGTH) || 6) {
  return Math.floor(Math.random() * 10 ** length)
    .toString()
    .padStart(length, "0");
}

function sendOtp(identifier, type = "verify") {
  const otp = generateOtp();
  const expiresAt = Date.now() + (Number(process.env.OTP_EXPIRE_MINUTES) || 5) * 60 * 1000;
  otpStore.set(identifier, { otp, type, expiresAt });

  // Email
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  if (isEmail) {
    const subject = type === "reset" ? "Password Reset OTP" : "Your Verification OTP";
    const html = `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`;
    sendEmail({ to: identifier, subject, html }).then(r => console.log("OTP Email sent"));
  } else {
    console.log(`[SMS STUB] OTP for ${identifier}: ${otp}`);
  }

  return { ok: true, otp }; // dev-only return
}

function verifyOtp(identifier, otp) {
  const record = otpStore.get(identifier);
  if (!record) return { ok: false, reason: "No OTP found" };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(identifier);
    return { ok: false, reason: "OTP expired" };
  }
  if (record.otp !== otp) return { ok: false, reason: "Invalid OTP" };
  otpStore.delete(identifier);
  return { ok: true, type: record.type };
}

module.exports = { sendOtp, verifyOtp };
