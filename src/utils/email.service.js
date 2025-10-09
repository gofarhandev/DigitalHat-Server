const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: `"DigitalHat" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: html || text || "",
      text: text || "",
    });
    console.log("Email sent:", info.messageId);
    return { ok: true, info };
  } catch (err) {
    console.error("sendEmail error:", err);
    return { ok: false, error: err };
  }
}

module.exports = { sendEmail };
