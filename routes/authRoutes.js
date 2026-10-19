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
  updateFcmToken,
  verifyAdminCredentials,
  checkAdminStatus,
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

// Admin Authentication (Secure check against backend environment)
router.post('/verify-admin', verifyAdminCredentials);
router.get('/check-admin-status', protect, checkAdminStatus);

// Profile & Notifications
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.delete('/account', protect, deleteUserAccount);
router.patch('/fcm-token', protect, updateFcmToken);

module.exports = router;
