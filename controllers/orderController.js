const Order = require('../models/Order');
const CartItem = require('../models/CartItem');
const { sendGmailOrderNotification } = require('../services/emailService');

// @desc    Place a new order
// @route   POST /api/v1/orders
// @access  Private
const placeOrder = async (req, res) => {
  try {
    const { items, deliveryAddress, subtotal, deliveryCharge, grandTotal, paymentMethod, paymentStatus, trackingCode } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No order items provided' });
    }

    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: 'Delivery address is required' });
    }

    const order = await Order.create({
      userId: req.user._id,
      userName: req.user?.name || deliveryAddress?.name || 'Customer',
      userEmail: req.user?.email || '',
      items,
      deliveryAddress,
      subtotal,
      deliveryCharge: deliveryCharge || 49.0,
      grandTotal,
      paymentMethod: paymentMethod || 'Cash on Delivery',
      status: 'Pending',
    });

    // Mark user cart items as ordered / clear cart
    await CartItem.deleteMany({ userId: req.user._id, status: 'in_cart' });

    // Send Gmail email notification asynchronously
    if (req.user && req.user.email) {
      sendGmailOrderNotification(req.user.email, {
        ...order.toObject(),
        trackingCode: trackingCode || `KCH-${order._id.toString().substring(18).toUpperCase()}`,
      });
    }

    return res.status(201).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user order history
// @route   GET /api/v1/orders
// @access  Private
const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/v1/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PATCH /api/v1/orders/:id/status
// @access  Private (Admin in future; open for demo)
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel an order (only if status is Pending)
// @route   PATCH /api/v1/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status is "${order.status}". Only Pending orders can be cancelled.`,
      });
    }

    order.status = 'Cancelled';
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order has been cancelled successfully.',
      order,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  placeOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
};
