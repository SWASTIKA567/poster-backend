const express = require('express');
const router = express.Router();
const {
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  registerUser,
  loginUser,
  googleSignIn,
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// OTP & Password Management
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Authentication
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleSignIn);

// Profile
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.delete('/account', protect, deleteUserAccount);

module.exports = router;
