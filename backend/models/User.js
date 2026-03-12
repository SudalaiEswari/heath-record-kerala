// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  mobile:      { type: String, required: true, unique: true, trim: true },
  email:       { type: String, trim: true, lowercase: true, default: '' },
  password:    { type: String, required: true, minlength: 8 },
  dob:         { type: String, required: true },
  bloodGroup:  { type: String, required: true, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'] },
  district:    { type: String, required: true },
  healthId:    { type: String, unique: true },
  isVerified:  { type: Boolean, default: false },
  role:        { type: String, enum: ['user','admin'], default: 'user' },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

// Auto-generate Health ID
userSchema.pre('save', async function(next) {
  if (this.isNew) {
    const year = new Date().getFullYear().toString().slice(-2);
    const rand = Math.floor(100000 + Math.random() * 900000);
    this.healthId = `KL${year}${rand}`;
  }
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);