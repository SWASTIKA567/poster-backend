const CartItem = require('../models/CartItem');

// @desc    Get user cart items
// @route   GET /api/v1/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const items = await CartItem.find({ userId: req.user._id, status: 'in_cart' }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: items.length, items });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add item to cart
// @route   POST /api/v1/cart
// @access  Private
const addToCart = async (req, res) => {
  try {
    const { imageUrl, size, quantity, totalPrice } = req.body;

    if (!imageUrl || !totalPrice) {
      return res.status(400).json({ success: false, message: 'Image URL and total price are required' });
    }

    const item = await CartItem.create({
      userId: req.user._id,
      imageUrl,
      size: size || 'A4',
      quantity: quantity || 1,
      totalPrice: Number(totalPrice),
      status: 'in_cart',
    });

    return res.status(201).json({ success: true, item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/:id
// @access  Private
const removeFromCart = async (req, res) => {
  try {
    const item = await CartItem.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }
    return res.status(200).json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/v1/cart
// @access  Private
const clearCart = async (req, res) => {
  try {
    await CartItem.deleteMany({ userId: req.user._id, status: 'in_cart' });
    return res.status(200).json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
};
