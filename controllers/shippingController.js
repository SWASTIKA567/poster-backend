const Order = require("../models/Order");
const shadowfaxService = require("../services/shadowfaxService");
const { sendOrderStatusEmail } = require("../services/emailService");

// @desc    Check Pincode Serviceability
// @route   GET /api/v1/shipping/check-pincode/:pincode
// @access  Public
const checkPincode = async (req, res) => {
  try {
    const { pincode } = req.params;
    if (!pincode || pincode.length !== 6) {
      return res.status(400).json({ success: false, message: "A valid 6-digit Indian PIN code is required" });
    }

    const result = await shadowfaxService.checkServiceability(pincode);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create Shadowfax Shipment for an Order
// @route   POST /api/v1/shipping/create-shipment/:orderId
// @access  Private (Admin / Internal)
const createShipmentForOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.waybillNumber) {
      return res.status(400).json({
        success: false,
        message: "Shipment already generated for this order",
        waybillNumber: order.waybillNumber,
        trackingUrl: order.trackingUrl
      });
    }

    const shipmentData = await shadowfaxService.createShipment(order);

    // Save tracking details directly into the order in MongoDB
    order.courierPartner = "Shadowfax";
    order.waybillNumber = shipmentData.waybillNumber;
    order.shadowfaxOrderId = shipmentData.shadowfaxOrderId;
    order.trackingUrl = shipmentData.trackingUrl;
    order.shippingLabelUrl = shipmentData.shippingLabelUrl;
    order.status = "Confirmed";
    await order.save();

    // Notify user via email with tracking number
    const recipientEmail = order.userEmail;
    if (recipientEmail) {
      sendOrderStatusEmail(recipientEmail, order.toObject(), "Confirmed").catch((e) =>
        console.error("Shipping confirmation email error:", e.message)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Shadowfax shipment created successfully!",
      order
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Track Shadowfax Shipment
// @route   GET /api/v1/shipping/track/:waybill
// @access  Public / Private
const trackShipment = async (req, res) => {
  try {
    const { waybill } = req.params;
    const trackingInfo = await shadowfaxService.trackShipment(waybill);
    return res.status(200).json({ success: true, tracking: trackingInfo });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Shadowfax Status Webhook (Auto-updates Order status in MongoDB)
// @route   POST /api/v1/shipping/webhook
// @access  Public (Called by Shadowfax servers)
const shadowfaxWebhook = async (req, res) => {
  try {
    const { waybill_number, client_order_id, status, current_location } = req.body;
    console.log("🚚 Shadowfax Webhook received:", req.body);

    const filter = waybill_number
      ? { waybillNumber: waybill_number }
      : { _id: client_order_id };

    const order = await Order.findOne(filter);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found for given waybill" });
    }

    // Map Shadowfax statuses to MongoDB order statuses
    const statusMap = {
      ASSIGNED: "Confirmed",
      PICKED_UP: "Shipped",
      IN_TRANSIT: "Shipped",
      OUT_FOR_DELIVERY: "Processing",
      DELIVERED: "Delivered",
      CANCELLED: "Cancelled",
      RTO: "Cancelled"
    };

    if (status && statusMap[status.toUpperCase()]) {
      const newStatus = statusMap[status.toUpperCase()];
      order.status = newStatus;
      await order.save();

      if (order.userEmail) {
        sendOrderStatusEmail(order.userEmail, order.toObject(), newStatus).catch((e) =>
          console.error("Webhook status email error:", e.message)
        );
      }
    }

    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Shadowfax webhook error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  checkPincode,
  createShipmentForOrder,
  trackShipment,
  shadowfaxWebhook
};
