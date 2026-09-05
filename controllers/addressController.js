const Address = require('../models/Address');

// @desc    Get all saved addresses for current user (default first, then newest)
// @route   GET /api/v1/addresses
// @access  Private
const getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
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
    const { name, phone, addressLine, city, state, pincode, isDefault } = req.body;

    if (!name || !phone || !addressLine || !city || !state || !pincode) {
      return res.status(400).json({ success: false, message: 'Please fill in all address fields' });
    }

    // Check if this is user's first address
    const existingCount = await Address.countDocuments({ userId: req.user._id });
    const shouldBeDefault = existingCount === 0 || isDefault === true;

    if (shouldBeDefault) {
      await Address.updateMany({ userId: req.user._id }, { isDefault: false });
    }

    const address = await Address.create({
      userId: req.user._id,
      name,
      phone,
      addressLine,
      city,
      state,
      pincode,
      isDefault: shouldBeDefault,
    });

    return res.status(201).json({ success: true, address });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Set default address
// @route   PATCH /api/v1/addresses/:id/default
// @access  Private
const setDefaultAddress = async (req, res) => {
  try {
    const target = await Address.findOne({ _id: req.params.id, userId: req.user._id });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // Unset all other defaults
    await Address.updateMany({ userId: req.user._id }, { isDefault: false });
    target.isDefault = true;
    await target.save();

    return res.status(200).json({ success: true, message: 'Default address updated', address: target });
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

    if (req.body.isDefault === true) {
      await Address.updateMany({ userId: req.user._id }, { isDefault: false });
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

    // If the deleted address was default, make the most recent one default
    if (address.isDefault) {
      const nextDefault = await Address.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }

    return res.status(200).json({ success: true, message: 'Address removed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAddresses,
  addAddress,
  setDefaultAddress,
  updateAddress,
  deleteAddress,
};
