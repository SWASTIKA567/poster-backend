const Poster = require('../models/Poster');
const { isCloudinaryConfigured, uploadBufferToCloudinary } = require('../services/cloudinaryService');

// @desc    Get all posters (with search, category & section filter)
// @route   GET /api/v1/posters
// @access  Public
const getPosters = async (req, res) => {
  try {
    const { search, category, section } = req.query;
    let query = { isAvailable: true };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    if (section && section !== 'all') {
      query.$or = [{ section: section }, { section: 'both' }];
    }

    const posters = await Poster.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: posters.length,
      posters,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get unique poster categories
// @route   GET /api/v1/posters/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const categories = await Poster.distinct('category', { isAvailable: true });
    return res.status(200).json({ success: true, categories: categories.filter(Boolean) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single poster details
// @route   GET /api/v1/posters/:id
// @access  Public
const getPosterById = async (req, res) => {
  try {
    const poster = await Poster.findById(req.params.id);
    if (!poster) {
      return res.status(404).json({ success: false, message: 'Poster not found' });
    }
    return res.status(200).json({ success: true, poster });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new poster
// @route   POST /api/v1/posters
// @access  Private
const createPoster = async (req, res) => {
  try {
    const { title, category, price, description, sizes, section } = req.body;
    let imageUrl = req.body.imageUrl;

    if (req.file) {
      if (isCloudinaryConfigured()) {
        const cloudRes = await uploadBufferToCloudinary(req.file.buffer, 'kechi_catalog_posters');
        imageUrl = cloudRes.secure_url;
      } else {
        imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      }
    }

    if (!title || !imageUrl || !price) {
      return res.status(400).json({ success: false, message: 'Title, image, and price are required' });
    }

    const basePrice = Number(price);
    let parsedSizes = [
      { label: 'A5', dimensions: '14.8 × 21 cm', price: Math.round(basePrice * 0.75) || 99 },
      { label: 'A4', dimensions: '21 × 29.7 cm', price: basePrice },
      { label: 'A3', dimensions: '29.7 × 42 cm', price: Math.round(basePrice * 1.6) || 249 },
    ];

    if (sizes) {
      try {
        parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
      } catch (err) {
        console.warn('Sizes parse fallback to default:', err.message);
      }
    }

    const validSections = ['explore', 'trending', 'both', 'none'];
    const chosenSection = validSections.includes(section) ? section : 'both';

    const poster = await Poster.create({
      title: title.trim(),
      imageUrl,
      category: category ? category.trim() : 'General',
      section: chosenSection,
      price: basePrice,
      description: description || '',
      sizes: parsedSizes,
      sellerId: req.user?._id,
    });

    return res.status(201).json({ success: true, poster });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update poster (category, title, section, etc.)
// @route   PUT /api/v1/posters/:id
// @access  Private
const updatePoster = async (req, res) => {
  try {
    const poster = await Poster.findById(req.params.id);
    if (!poster) {
      return res.status(404).json({ success: false, message: 'Poster not found' });
    }

    const { category, title, description, isAvailable, section, price } = req.body;
    if (category) poster.category = category.trim();
    if (title) poster.title = title.trim();
    if (description !== undefined) poster.description = description;
    if (isAvailable !== undefined) poster.isAvailable = isAvailable;
    if (price !== undefined && !isNaN(price)) poster.price = Number(price);

    const validSections = ['explore', 'trending', 'both', 'none'];
    if (section && validSections.includes(section)) {
      poster.section = section;
    }

    await poster.save();
    return res.status(200).json({ success: true, poster });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete poster
// @route   DELETE /api/v1/posters/:id
// @access  Private
const deletePoster = async (req, res) => {
  try {
    const poster = await Poster.findById(req.params.id);
    if (!poster) {
      return res.status(404).json({ success: false, message: 'Poster not found' });
    }

    await poster.deleteOne();
    return res.status(200).json({ success: true, message: 'Poster removed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPosters,
  getCategories,
  getPosterById,
  createPoster,
  updatePoster,
  deletePoster,
};
