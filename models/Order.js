const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  size: { type: String, required: true },
  quantity: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
});

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      default: '',
    },
    userEmail: {
      type: String,
      default: '',
    },
    items: [orderItemSchema],
    deliveryAddress: {
      name: String,
      phone: String,
      addressLine: String,
      city: String,
      state: String,
      pincode: String,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    deliveryCharge: {
      type: Number,
      default: 49.0,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: 'Cash on Delivery',
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Order', orderSchema);
