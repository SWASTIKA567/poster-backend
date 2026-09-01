const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['verification', 'password_reset', 'login'],
      default: 'verification',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // Document automatically deleted from MongoDB after 600 seconds (10 minutes)
    },
  },
  {
    timestamps: false,
  }
);

otpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model('Otp', otpSchema);
