const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  mobile:    { type: String, required: true },
  otp:       { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 },
  verified:  { type: Boolean, default: false },
});

module.exports = mongoose.model('OTP', otpSchema);