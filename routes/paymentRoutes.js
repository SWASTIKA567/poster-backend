const express = require("express");
const router = express.Router();
const { createRazorpayOrder, verifyRazorpayPayment, getRazorpayConfig } = require("../controllers/razorpayController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

// GET /api/v1/payment/config
router.get("/config", getRazorpayConfig);

// POST /api/v1/payment/create-order
router.post("/create-order", createRazorpayOrder);

// POST /api/v1/payment/verify
router.post("/verify", verifyRazorpayPayment);

module.exports = router;
