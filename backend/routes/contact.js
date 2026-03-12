// routes/contact.js
const express = require('express');
const router  = express.Router();

// ─── POST /api/contact ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, contact, subject, message } = req.body;
    if (!name || !contact || !message)
      return res.status(400).json({ success: false, message: 'Name, contact, and message are required.' });

    // In production, send email via nodemailer / SendGrid
    console.log('[CONTACT FORM]', { name, contact, subject, message });

    res.json({ success: true, message: 'Message received. We will respond within 24 hours.' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

module.exports = router;