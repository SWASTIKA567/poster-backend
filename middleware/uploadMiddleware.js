const multer = require('multer');
const path = require('path');

// Use memory storage — file goes to Cloudinary or local disk fallback
const storage = multer.memoryStorage();

// Robust file filter — accept ANY image format from camera or gallery
const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  // 1. Any image/* MIME type (image/jpeg, image/png, image/webp, image/heic, etc.)
  if (mime.startsWith('image/')) {
    return cb(null, true);
  }

  // 2. Known image file extensions (in case MIME type is missing or generic)
  const allowedExts = /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/i;
  if (allowedExts.test(ext)) {
    return cb(null, true);
  }

  // 3. Accept application/octet-stream or empty MIME (standard on many Android camera/picker intents)
  if (mime === 'application/octet-stream' || !mime) {
    return cb(null, true);
  }

  cb(new Error('Only image files are allowed (jpg, png, webp, heic)'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for high-res camera captures
  fileFilter: fileFilter,
});

module.exports = upload;
