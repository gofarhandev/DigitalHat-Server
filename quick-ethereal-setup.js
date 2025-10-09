// quick-ethereal-setup.js (one-time dev test)
const nodemailer = require("nodemailer");

(async () => {
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  const info = await transporter.sendMail({
    from: '"Ethereal Test" <test@example.com>',
    to: "recipient@example.com",
    subject: "Ethereal OTP test",
    html: "<b>Your OTP is 123456</b>",
  });

  console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
})();
