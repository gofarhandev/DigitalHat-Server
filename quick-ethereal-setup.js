// mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS will be used with STARTTLS
  auth: {
    user: process.env.SMTP_USER, // your full gmail address
    pass: process.env.SMTP_PASS, // Gmail App Password (16 chars)
  },
});

// verify connection (good for startup logs)
transporter
  .verify()
  .then(() => console.log("SMTP verified ✅"))
  .catch((err) => console.error("SMTP verify failed ❌", err));

async function sendOtpEmail(to, otp) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: "Your OTP code",
      text: `Your OTP: ${otp}`,
      html: `<p>Your OTP: <b>${otp}</b></p>`,
    });
    console.log("OTP Email sent, messageId:", info.messageId);
    return { ok: true, info };
  } catch (err) {
    console.error("sendEmail error:", err);
    return { ok: false, error: err };
  }
}

module.exports = { sendOtpEmail };
