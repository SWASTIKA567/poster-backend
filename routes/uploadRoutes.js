const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/uploadMiddleware');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { isCloudinaryConfigured, uploadBufferToCloudinary } = require('../services/cloudinaryService');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// @desc    Upload single image (Cloudinary with local disk fallback)
// @route   POST /api/v1/upload
// @access  Public / Optional Auth
router.post('/', optionalProtect, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Multer upload middleware error:', err.message);
      return res.status(400).json({
        success: false,
        message: err.message || 'Image upload failed. Please ensure file is an image under 25MB.',
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }

    // 1. If Cloudinary is configured, upload to Cloudinary
    if (isCloudinaryConfigured()) {
      const result = await uploadBufferToCloudinary(req.file.buffer, 'kechi_posters');
      return res.status(200).json({
        success: true,
        imageUrl: result.secure_url,
        publicId: result.public_id,
        storage: 'cloudinary',
      });
    }

    // 2. Fallback to saving to local disk if Cloudinary credentials are not set
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `image-${uniqueSuffix}${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    return res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      filename: filename,
      storage: 'local',
      notice: 'Using local storage. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env for persistent cloud storage.',
    });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Image upload failed' });
  }
});

// @desc    List all local uploaded images (admin view)
// @route   GET /api/v1/upload/list
// @access  Private
router.get('/list', protect, (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(uploadDir, f));
        return {
          filename: f,
          url: `${req.protocol}://${req.get('host')}/uploads/${f}`,
          sizeKB: Math.round(stat.size / 1024),
          uploadedAt: stat.mtime,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return res.status(200).json({ success: true, count: files.length, files });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Delete an uploaded image by filename
// @route   DELETE /api/v1/upload/:filename
// @access  Private
router.delete('/:filename', protect, (req, res) => {
  try {
    const filePath = path.join(uploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    fs.unlinkSync(filePath);
    return res.status(200).json({ success: true, message: 'File deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
