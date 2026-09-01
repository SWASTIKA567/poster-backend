const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const CartItem = require('../models/CartItem');
const Address = require('../models/Address');
const Wishlist = require('../models/Wishlist');
const { OAuth2Client } = require('google-auth-library');
const {
  sendOtpEmail,
  sendLoginNotificationEmail,
  sendWelcomeEmail,
} = require('../services/emailService');

const googleClient = new OAuth2Client();

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'poster_app_super_secret_jwt_key_2026', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

// Helper to generate 6-digit numeric OTP
const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Send 6-digit OTP to email
// @route   POST /api/v1/auth/send-otp
// @access  Public
const sendOtp = async (req, res) => {
  try {
    const { email, purpose = 'verification' } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Delete any existing active OTP for this email & purpose
    await Otp.deleteMany({ email: cleanEmail, purpose });

    const otpCode = generateOtpCode();

    // Store in MongoDB (auto-deletes after 10 mins via TTL)
    await Otp.create({
      email: cleanEmail,
      otp: otpCode,
      purpose,
    });

    // Send email asynchronously
    sendOtpEmail(cleanEmail, otpCode, purpose).catch((err) => {
      console.error('Async OTP email send error:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${cleanEmail}`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify 6-digit OTP
// @route   POST /api/v1/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
  try {
    const { email, otp, purpose = 'verification' } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const record = await Otp.findOne({ email: cleanEmail, otp: cleanOtp, purpose });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
    }

    // Delete the used OTP
    await record.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/v1/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address' });
    }

    // Delete existing reset OTPs
    await Otp.deleteMany({ email: cleanEmail, purpose: 'password_reset' });

    const otpCode = generateOtpCode();
    await Otp.create({
      email: cleanEmail,
      otp: otpCode,
      purpose: 'password_reset',
    });

    sendOtpEmail(cleanEmail, otpCode, 'password_reset').catch((err) => {
      console.error('Async password reset email send error:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP has been sent to your email',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset Password with OTP
// @route   POST /api/v1/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const record = await Otp.findOne({
      email: cleanEmail,
      otp: cleanOtp,
      purpose: 'password_reset',
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Set new password (will trigger userSchema pre('save') hash)
    user.password = newPassword;
    await user.save();

    // Remove used OTP
    await record.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully! You can now log in.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name,
      email: cleanEmail,
      password,
      phone: phone || '',
      provider: 'email',
    });

    const token = generateToken(user._id);

    // Send Welcome Email asynchronously
    sendWelcomeEmail(cleanEmail, user.name).catch((err) => {
      console.error('Async welcome email send error:', err.message);
    });

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        phone: user.phone,
        provider: user.provider,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login user with Email & Password
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password, platform } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter email and password' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    user.lastLoginAt = Date.now();
    await user.save();

    const token = generateToken(user._id);

    // Send Login Security Alert Email asynchronously
    sendLoginNotificationEmail(cleanEmail, user.name, { platform: platform || 'Mobile App' }).catch((err) => {
      console.error('Async login notification send error:', err.message);
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        phone: user.phone,
        provider: user.provider,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Google Sign In
// @route   POST /api/v1/auth/google
// @access  Public
const googleSignIn = async (req, res) => {
  try {
    const { idToken, email: bodyEmail, name: bodyName, picture: bodyPicture, platform } = req.body;
    let email = bodyEmail;
    let name = bodyName;
    let picture = bodyPicture;

    if (idToken) {
      try {
        const ticket = await googleClient.verifyIdToken({ idToken });
        const payload = ticket.getPayload();
        if (payload) {
          email = payload.email || email;
          name = payload.name || name;
          picture = payload.picture || picture;
        }
      } catch (err) {
        console.log('Google token verification notice (using payload fallback):', err.message);
      }
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Google account email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        name: name || cleanEmail.split('@')[0] || 'Google User',
        email: cleanEmail,
        photoUrl: picture || '',
        provider: 'google',
      });
    } else {
      user.lastLoginAt = Date.now();
      if (picture && !user.photoUrl) user.photoUrl = picture;
      if (name && (!user.name || user.name === 'Customer')) user.name = name;
      await user.save();
    }

    const token = generateToken(user._id);

    // Send Welcome Email if brand new user, or Login Alert if existing user
    if (isNewUser) {
      sendWelcomeEmail(cleanEmail, user.name).catch((err) => {
        console.error('Async welcome email send error:', err.message);
      });
    } else {
      sendLoginNotificationEmail(cleanEmail, user.name, { platform: platform || 'Google Sign-In' }).catch((err) => {
        console.error('Async login notification send error:', err.message);
      });
    }

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        phone: user.phone,
        provider: user.provider,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Current Logged In User Profile
// @route   GET /api/v1/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        phone: user.phone,
        provider: user.provider,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update User Profile
// @route   PUT /api/v1/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.name = req.body.name || user.name;
    user.phone = req.body.phone !== undefined ? req.body.phone : user.phone;
    if (req.body.photoUrl) user.photoUrl = req.body.photoUrl;

    const updatedUser = await user.save();

    return res.status(200).json({
      success: true,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        photoUrl: updatedUser.photoUrl,
        phone: updatedUser.phone,
        provider: updatedUser.provider,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete User Account (Google Play Compliance)
// @route   DELETE /api/v1/users/account
// @access  Private
const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Remove user related records
    await CartItem.deleteMany({ userId });
    await Address.deleteMany({ userId });
    await Wishlist.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: 'User account and associated data have been permanently deleted.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
