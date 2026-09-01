const mongoose = require('mongoose');

const posterSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Poster title is required'],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, 'Poster image URL is required'],
    },
    category: {
      type: String,
      default: 'General',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
    },
    sizes: [
      {
        label: { type: String, required: true }, // "A5", "A4", "A3"
        dimensions: { type: String, required: true }, // "21 × 29.7 cm"
        price: { type: Number, required: true },
      },
    ],
    description: {
      type: String,
      default: '',
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Poster', posterSchema);
