// routes/users.js
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const auth    = require('../middleware/auth');

// ─── GET /api/users/profile ───────────────────────────────────────────────
router.get('/profile', auth, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─── PUT /api/users/profile ───────────────────────────────────────────────
router.put('/profile', auth, async (req, res) => {
  try {
    const allowed = ['name', 'email', 'dob', 'district', 'bloodGroup'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({ success: true, message: 'Profile updated.', user });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// ─── PUT /api/users/change-password ──────────────────────────────────────
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Invalid request.' });

    const user = await User.findById(req.user._id);
    const match = await user.comparePassword(currentPassword);
    if (!match)
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// ─── DELETE /api/users/account ────────────────────────────────────────────
router.delete('/account', auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.json({ success: true, message: 'Account deleted.' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete account.' });
  }
});

module.exports = router;