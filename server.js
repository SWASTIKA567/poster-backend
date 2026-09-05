const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dns = require('dns');
require('dotenv').config();

// Prioritize IPv4 globally to prevent ENETUNREACH on cloud platforms (Render/Docker)
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.log('DNS config notice:', e.message);
}

const authRoutes = require('./routes/authRoutes');
const posterRoutes = require('./routes/posterRoutes');
const cartRoutes = require('./routes/cartRoutes');
const addressRoutes = require('./routes/addressRoutes');
const orderRoutes = require('./routes/orderRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Poster Backend API is running smoothly!' });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', authRoutes); // Shares profile routes
app.use('/api/v1/posters', posterRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/upload', uploadRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Connect to MongoDB & Start Server
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/poster_db';

// Disable buffering so queries fail immediately (with a clear error) when DB is not connected
mongoose.set('bufferCommands', false);

// Middleware: reject API requests early if MongoDB is not yet connected
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database not connected. Please try again in a moment.',
    });
  }
  next();
});

// Start Server listening on 0.0.0.0 immediately
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on http://0.0.0.0:${PORT}`);
});

// Connect to MongoDB asynchronously (retries automatically on disconnect)
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.error('👉 Fix: Go to MongoDB Atlas → Network Access → Add your IP or 0.0.0.0/0');
  });

