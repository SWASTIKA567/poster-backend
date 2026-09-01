const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CartItem = require('../models/CartItem');
const Address = require('../models/Address');
const Wishlist = require('../models/Wishlist');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client();

// Helper to generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'poster_app_super_secret_jwt_key_2026', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
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

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone: phone || '',
      provider: 'email',
    });

    const token = generateToken(user._id);

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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    user.lastLoginAt = Date.now();
    await user.save();

    const token = generateToken(user._id);

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
    const { idToken, email: bodyEmail, name: bodyName, picture: bodyPicture } = req.body;
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

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: name || email.split('@')[0] || 'Google User',
        email,
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
  registerUser,
  loginUser,
  googleSignIn,
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
};
