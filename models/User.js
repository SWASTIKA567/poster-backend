const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return this.provider === 'email';
      },
      minlength: 6,
      select: false, // Don't return password by default
    },
    photoUrl: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    provider: {
      type: String,
      enum: ['email', 'google'],
      default: 'email',
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Helper method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
