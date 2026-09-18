const fs = require("fs");
let code = fs.readFileSync("server.js", "utf8");

const oldWhatsAppCode = `const sendWhatsApp = (message) => {
  const phone = process.env.WSP_PHONE || '+56933105415';
  const apikey = process.env.CALLMEBOT_API_KEY;
  if (!apikey) {
    console.log("WhatsApp API Key no configurada. Mensaje:", message);
    return;
  }
  const url = "https://api.callmebot.com/whatsapp.php?phone=" + encodeURIComponent(phone) + "&text=" + encodeURIComponent(message) + "&apikey=" + apikey;
  https.get(url, (res) => {
    res.on('data', () => {});
  }).on('error', (err) => console.error("Error WSP:", err.message));
};`;

const newEmailCode = `const sendEmail = (message) => {
  const email = process.env.EMAIL_USER || 'jeffry.campos.martinez@gmail.com';
  const pass = process.env.EMAIL_APP_PASSWORD;
  if (!pass) {
    console.log("EMAIL_APP_PASSWORD no configurada. Mensaje:", message);
    return;
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass: pass }
  });
  transporter.sendMail({
    from: email,
    to: 'jeffry.campos.martinez@gmail.com',
    subject: '🤖 Alerta: TCG Master Downloader',
    text: message
  }, (err) => {
    if (err) console.error("Error enviando correo:", err.message);
  });
};`;

code = code.replace(oldWhatsAppCode, newEmailCode);
code = code.replace(/sendWhatsApp\(/g, "sendEmail(");

fs.writeFileSync("server.js", code);
