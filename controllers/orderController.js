const Order = require('../models/Order');
const CartItem = require('../models/CartItem');
const { sendGmailOrderNotification, sendOrderStatusEmail, sendAdminNewOrderAlert, sendReplacementRequestEmail } = require('../services/emailService');
const shadowfaxService = require('../services/shadowfaxService');
const { sendPushToUser } = require('../services/fcmService');
const { isNcrRegion } = require('../utils/ncrHelper');

// @desc    Place a new order
// @route   POST /api/v1/orders
// @access  Private
const placeOrder = async (req, res) => {
  try {
    const { items, deliveryAddress, subtotal, deliveryCharge, grandTotal, paymentMethod, paymentStatus, trackingCode, razorpayPaymentId, razorpayOrderId } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No order items provided' });
    }

    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: 'Delivery address is required' });
    }

    if (!isNcrRegion({
      state: deliveryAddress.state,
      district: deliveryAddress.city,
      pincode: deliveryAddress.pincode,
    })) {
      return res.status(400).json({
        success: false,
        message: 'Delivery Coming Soon! We currently deliver only across the whole region of Delhi-NCR.',
      });
    }

    const totalQuantity = (items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
    const calculatedDeliveryCharge = totalQuantity >= 7 ? 0.0 : (deliveryCharge !== undefined ? deliveryCharge : 39.0);

    const order = await Order.create({
      userId: req.user._id,
      userName: req.user?.name || deliveryAddress?.name || 'Customer',
      userEmail: req.user?.email || '',
      items,
      deliveryAddress,
      subtotal,
      deliveryCharge: calculatedDeliveryCharge,
      grandTotal,
      paymentMethod: paymentMethod || 'Cash on Delivery',
      razorpayPaymentId: razorpayPaymentId || null,
      razorpayOrderId: razorpayOrderId || null,
      status: 'Pending',
    });

    // Automatically create Shadowfax Logistics shipment & generate Waybill (AWB)
    try {
      const shipment = await shadowfaxService.createShipment(order);
      order.courierPartner = 'Shadowfax';
      order.waybillNumber = shipment.waybillNumber;
      order.shadowfaxOrderId = shipment.shadowfaxOrderId;
      order.trackingUrl = shipment.trackingUrl;
      order.shippingLabelUrl = shipment.shippingLabelUrl;
      await order.save();
    } catch (shipErr) {
      console.error('Auto Shadowfax shipment generation notice:', shipErr.message);
    }

    // Mark user cart items as ordered / clear cart
    await CartItem.deleteMany({ userId: req.user._id, status: 'in_cart' });

    // Send Gmail email notification asynchronously
    if (req.user && req.user.email) {
      sendGmailOrderNotification(req.user.email, {
        ...order.toObject(),
        trackingCode: order.waybillNumber || trackingCode || `KCH-${order._id.toString().substring(18).toUpperCase()}`,
      });
    }

    // Send instant Admin Email Alert with direct links to download custom uploaded images
    sendAdminNewOrderAlert({
      ...order.toObject(),
      userName: req.user?.name || deliveryAddress?.name || 'Customer',
      userEmail: req.user?.email || order.userEmail || deliveryAddress?.email || '',
      trackingCode: order.waybillNumber || trackingCode || `KCH-${order._id.toString().substring(18).toUpperCase()}`,
    }).catch((e) => console.error('Admin order alert dispatch notice:', e.message));

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
    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updateData = { status };
    if (status === 'Delivered') {
      updateData.deliveredAt = new Date();
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Send order status email notification
    const recipientEmail = req.user?.email || order.userEmail;
    if (recipientEmail) {
      sendOrderStatusEmail(recipientEmail, order.toObject(), status).catch((err) => {
        console.error('Async order status email error:', err.message);
      });
    }

    // Send real-time push notification to user's phone
    const pushTitle = status === 'Shipped'
      ? 'Your Poster Has Been Shipped'
      : status === 'Out for Delivery'
          ? 'Out for Delivery'
          : status === 'Delivered'
              ? 'Order Delivered'
              : `Order Update: ${status}`;

    const pushBody = status === 'Shipped'
      ? `Order #${order.waybillNumber || order.trackingCode || order._id} is in transit!`
      : status === 'Out for Delivery'
          ? `Your Kechi poster is almost there! Shadowfax rider is on the way.`
          : status === 'Delivered'
              ? `Your Kechi poster order has arrived. Enjoy your vibe!`
              : `Your order #${order.waybillNumber || order.trackingCode || order._id} is now ${status}.`;

    sendPushToUser(order.userId, {
      title: pushTitle,
      body: pushBody,
      data: {
        orderId: order._id.toString(),
        status: status,
        type: 'order',
      },
    }).catch((e) => console.error("Manual order status push error:", e.message));

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

    // 2-Hour Automatic Cancellation Window for custom printed posters
    const orderCreatedAt = order.createdAt ? new Date(order.createdAt).getTime() : Date.now();
    const ageInHours = (Date.now() - orderCreatedAt) / (1000 * 60 * 60);

    if (ageInHours > 2) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation window expired. Custom posters automatically enter printing production 2 hours after order placement.',
      });
    }

    order.status = 'Cancelled';
    await order.save();

    // Send order cancellation email notification
    const recipientEmail = req.user?.email || order.userEmail;
    if (recipientEmail) {
      sendOrderStatusEmail(recipientEmail, order.toObject(), 'Cancelled').catch((err) => {
        console.error('Async cancel order email error:', err.message);
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order has been cancelled successfully.',
      order,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit defect replacement request with photo & issue details (within 24 hours of delivery)
// @route   POST /api/v1/orders/:id/replacement
// @access  Private
const requestReplacement = async (req, res) => {
  try {
    const { reason, photos } = req.body;
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Replacement can only be requested once the order has been delivered.',
      });
    }

    // 24-Hour window verification
    const deliveredTime = order.deliveredAt
      ? new Date(order.deliveredAt).getTime()
      : (order.updatedAt ? new Date(order.updatedAt).getTime() : Date.now());
    const hoursSinceDelivery = (Date.now() - deliveredTime) / (1000 * 60 * 60);

    if (hoursSinceDelivery > 24) {
      return res.status(400).json({
        success: false,
        message: 'Replacement window expired. Defective items must be reported within 24 hours of delivery per Kechi policy.',
      });
    }

    if (order.replacementRequest && order.replacementRequest.status === 'Requested') {
      return res.status(400).json({
        success: false,
        message: 'A replacement request has already been submitted for this order.',
      });
    }

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a clear description of the defect or issue.',
      });
    }

    const photoList = Array.isArray(photos) ? photos.filter(p => !!p) : (photos ? [photos] : []);
    if (photoList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one photo showing the defective poster.',
      });
    }

    order.replacementRequest = {
      status: 'Requested',
      reason: reason.trim(),
      photos: photoList,
      requestedAt: new Date(),
    };

    await order.save();

    // Trigger email alert to Kechi support team
    sendReplacementRequestEmail({
      orderId: order._id,
      userEmail: req.user?.email || order.userEmail,
      userName: req.user?.name || order.deliveryAddress?.name || 'Customer',
      reason: reason.trim(),
      photos: photoList,
      deliveryAddress: order.deliveryAddress,
    }).catch((err) => {
      console.error('Async sendReplacementRequestEmail error:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: 'Replacement request submitted successfully! Our team will inspect your photos and dispatch a 100% free reprint.',
      order,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update replacement request status and delivery tracking (Admin)
// @route   PATCH /api/v1/orders/:id/replacement-status
// @access  Private
const updateReplacementStatus = async (req, res) => {
  try {
    const { status, waybillNumber, trackingUrl, courierPartner, adminNotes } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (!order.replacementRequest) {
      order.replacementRequest = { status: 'None', photos: [] };
    }

    if (status) order.replacementRequest.status = status;
    if (waybillNumber) order.replacementRequest.waybillNumber = waybillNumber;
    if (trackingUrl) order.replacementRequest.trackingUrl = trackingUrl;
    if (courierPartner) order.replacementRequest.courierPartner = courierPartner;
    if (adminNotes) order.replacementRequest.adminNotes = adminNotes;

    if (status === 'Approved') order.replacementRequest.approvedAt = new Date();
    if (status === 'Shipped') order.replacementRequest.shippedAt = new Date();
    if (status === 'Delivered') order.replacementRequest.deliveredAt = new Date();

    await order.save();

    // Push notification to user about replacement delivery status
    if (order.userId) {
      const title = status === 'Shipped'
        ? 'Replacement Poster Shipped'
        : status === 'Delivered'
            ? 'Replacement Poster Delivered'
            : `Replacement Update: ${status}`;

      const body = status === 'Shipped'
        ? `Your free replacement poster is on the way via ${order.replacementRequest.courierPartner || 'Shadowfax'}!`
        : `Status for your replacement order is now: ${status}`;

      sendPushToUser(order.userId, {
        title,
        body,
        data: {
          orderId: order._id.toString(),
          type: 'replacement',
        },
      }).catch((e) => console.error("Replacement push error:", e.message));
    }

    return res.status(200).json({
      success: true,
      message: `Replacement delivery status updated to ${status}.`,
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
  requestReplacement,
  updateReplacementStatus,
};
