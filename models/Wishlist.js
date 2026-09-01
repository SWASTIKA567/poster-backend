const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate wishlist entries for the same user + poster title
wishlistSchema.index({ userId: 1, title: 1 }, { unique: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
