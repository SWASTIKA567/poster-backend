const express = require('express');
const router = express.Router();
const {
  getPosters,
  getPosterById,
  createPoster,
  deletePoster,
} = require('../controllers/posterController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', getPosters);
router.get('/:id', getPosterById);
router.post('/', protect, upload.single('image'), createPoster);
router.delete('/:id', protect, deletePoster);

module.exports = router;
