const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      default: 'A4',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['in_cart', 'ordered'],
      default: 'in_cart',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('CartItem', cartItemSchema);
