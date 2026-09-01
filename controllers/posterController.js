const Poster = require('../models/Poster');

// @desc    Get all posters (with search & category filter)
// @route   GET /api/v1/posters
// @access  Public
const getPosters = async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = { isAvailable: true };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
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
    const { title, category, price, description, sizes } = req.body;
    let imageUrl = req.body.imageUrl;

    if (req.file) {
      imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    if (!title || !imageUrl || !price) {
      return res.status(400).json({ success: false, message: 'Title, image, and price are required' });
    }

    const poster = await Poster.create({
      title,
      imageUrl,
      category: category || 'General',
      price: Number(price),
      description: description || '',
      sizes: sizes ? JSON.parse(sizes) : [
        { label: 'A5', dimensions: '14.8 × 21 cm', price: 99 },
        { label: 'A4', dimensions: '21 × 29.7 cm', price: 149 },
        { label: 'A3', dimensions: '29.7 × 42 cm', price: 249 },
      ],
      sellerId: req.user._id,
    });

    return res.status(201).json({ success: true, poster });
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
  getPosterById,
  createPoster,
  deletePoster,
};
