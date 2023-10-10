const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router(); // Create an Express router instance
const cors = require('cors');

router.use(cors());
router.use(express.json());

router.post('/send-email', async (req, res) => {
  const { name, phone, email, message } = req.body;

  // Retrieve Gmail credentials and destination email from environment variables
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_PASS;
  const toEmail = process.env.TO_EMAIL;
  const subject = process.env.SUBJECT || 'Mensaje de contacto';

  // Configure the email transporter
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  // Define the email message
  const mailOptions = {
    from: gmailUser,
    to: toEmail,
    subject: subject,
    text: `Nombre: ${name}\nTelefono: ${phone}\nCorreo electrónico: ${email}\nMensaje: ${message}`,
  };

  try {
    // Send the email
    await transporter.sendMail(mailOptions);
    res.status(200).json({ mensaje: 'Correo electrónico enviado con éxito' });
  } catch (error) {
    console.error('Error al enviar el correo electrónico:', error);
    res.status(500).json({ mensaje: 'Ocurrió un error al enviar el correo electrónico' });
  }
});

module.exports = router; // Export the router instance
