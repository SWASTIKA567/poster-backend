const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  googleSignIn,
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleSignIn);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.delete('/account', protect, deleteUserAccount);

module.exports = router;
