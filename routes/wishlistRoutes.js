const express = require('express');
const router = express.Router();
const {
  getWishlist,
  toggleWishlist,
  removeWishlistItem,
} = require('../controllers/wishlistController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getWishlist);
router.post('/toggle', toggleWishlist);
router.delete('/:id', removeWishlistItem);

module.exports = router;
