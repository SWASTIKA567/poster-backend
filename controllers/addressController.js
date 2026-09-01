const Address = require('../models/Address');

// @desc    Get all saved addresses for current user
// @route   GET /api/v1/addresses
// @access  Private
const getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: addresses.length, addresses });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add new address
// @route   POST /api/v1/addresses
// @access  Private
const addAddress = async (req, res) => {
  try {
    const { name, phone, addressLine, city, state, pincode } = req.body;

    if (!name || !phone || !addressLine || !city || !state || !pincode) {
      return res.status(400).json({ success: false, message: 'Please fill in all address fields' });
    }

    const address = await Address.create({
      userId: req.user._id,
      name,
      phone,
      addressLine,
      city,
      state,
      pincode,
    });

    return res.status(201).json({ success: true, address });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update an address
// @route   PUT /api/v1/addresses/:id
// @access  Private
const updateAddress = async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, userId: req.user._id });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    Object.assign(address, req.body);
    await address.save();

    return res.status(200).json({ success: true, address });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete an address
// @route   DELETE /api/v1/addresses/:id
// @access  Private
const deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }
    return res.status(200).json({ success: true, message: 'Address removed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
};
