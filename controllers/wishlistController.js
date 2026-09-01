const Wishlist = require('../models/Wishlist');

// @desc    Get user wishlist items
// @route   GET /api/v1/wishlist
// @access  Private
const getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, wishlist });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle wishlist item (Add if not in wishlist, remove if already in)
// @route   POST /api/v1/wishlist/toggle
// @access  Private
const toggleWishlist = async (req, res) => {
  try {
    const { title, image } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const existing = await Wishlist.findOne({ userId: req.user._id, title });
    if (existing) {
      await existing.deleteOne();
      return res.status(200).json({ success: true, isFavorited: false, message: 'Removed from wishlist' });
    } else {
      const item = await Wishlist.create({ userId: req.user._id, title, image: image || '' });
      return res.status(201).json({ success: true, isFavorited: true, message: 'Added to wishlist', item });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove a wishlist item by its document ID
// @route   DELETE /api/v1/wishlist/:id
// @access  Private
const removeWishlistItem = async (req, res) => {
  try {
    const item = await Wishlist.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Wishlist item not found' });
    }
    return res.status(200).json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getWishlist,
  toggleWishlist,
  removeWishlistItem,
};
