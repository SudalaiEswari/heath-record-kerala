// routes/auth.js
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const OTP     = require('../models/OTP');
const auth    = require('../middleware/auth');

// ─── Helpers ──────────────────────────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

// In production replace this with Twilio / MSG91
async function sendSMSOTP(mobile, otp) {
  if (process.env.OTP_PROVIDER === 'twilio') {
    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
    await twilio.messages.create({
      body: `Your Health Record Kerala OTP is: ${otp}. Valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE,
      to: `+91${mobile}`,
    });
  } else {
    // Demo mode – just log
    console.log(`[OTP DEMO] Mobile: ${mobile}  OTP: ${otp}`);
  }
}

// ─── POST /api/auth/send-otp ──────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || mobile.length < 10)
      return res.status(400).json({ success: false, message: 'Invalid mobile number.' });

    const otp = generateOTP();
    await OTP.deleteMany({ mobile });           // remove old OTPs
    await OTP.create({ mobile, otp });
    await sendSMSOTP(mobile, otp);

    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send OTP.' });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const record = await OTP.findOne({ mobile, otp });
    if (!record)
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });

    record.verified = true;
    await record.save();
    res.json({ success: true, message: 'OTP verified.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'OTP verification failed.' });
  }
});

// ─── POST /api/auth/register ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, mobile, password, email, dob, bloodGroup, district } = req.body;

    // Basic validation
    if (!name || !mobile || !password || !dob || !bloodGroup || !district)
      return res.status(400).json({ success: false, message: 'Please fill all required fields.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    // Check OTP was verified
    const otpRecord = await OTP.findOne({ mobile, verified: true });
    if (!otpRecord)
      return res.status(400).json({ success: false, message: 'Mobile not verified. Please verify OTP first.' });

    // Check duplicate
    const existing = await User.findOne({ mobile });
    if (existing)
      return res.status(409).json({ success: false, message: 'Mobile number already registered.' });

    const user = await User.create({ name, mobile, password, email: email || '', dob, bloodGroup, district, isVerified: true });
    await OTP.deleteMany({ mobile });

    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      user: { ...user.toSafeObject(), token },
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'Mobile or Health ID already exists.' });
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password)
      return res.status(400).json({ success: false, message: 'Mobile and password required.' });

    const user = await User.findOne({ mobile });
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const match = await user.comparePassword(password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const token = signToken(user._id);
    res.json({ success: true, message: 'Login successful!', user: { ...user.toSafeObject(), token } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────
router.get('/me', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { mobile } = req.body;
    const user = await User.findOne({ mobile });
    if (!user)
      return res.status(404).json({ success: false, message: 'No account with this mobile number.' });

    const otp = generateOTP();
    await OTP.deleteMany({ mobile });
    await OTP.create({ mobile, otp });
    await sendSMSOTP(mobile, otp);
    res.json({ success: true, message: 'OTP sent for password reset.' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to initiate password reset.' });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { mobile, otp, newPassword } = req.body;
    if (!mobile || !otp || !newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Invalid request.' });

    const record = await OTP.findOne({ mobile, otp, verified: true });
    if (!record)
      return res.status(400).json({ success: false, message: 'OTP not verified.' });

    const user = await User.findOne({ mobile });
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found.' });

    user.password = newPassword;
    await user.save();
    await OTP.deleteMany({ mobile });
    res.json({ success: true, message: 'Password reset successful.' });
  } catch {
    res.status(500).json({ success: false, message: 'Password reset failed.' });
  }
});

module.exports = router;