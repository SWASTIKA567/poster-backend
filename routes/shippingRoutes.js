const express = require("express");
const router = express.Router();
const {
  checkPincode,
  createShipmentForOrder,
  trackShipment,
  shadowfaxWebhook
} = require("../controllers/shippingController");
const { protect } = require("../middleware/authMiddleware");

// Public endpoints
router.get("/check-pincode/:pincode", checkPincode);
router.get("/track/:waybill", trackShipment);
router.post("/webhook", shadowfaxWebhook);

// Protected endpoints
router.post("/create-shipment/:orderId", protect, createShipmentForOrder);

module.exports = router;
