const express = require("express");
const router = express.Router();
const { createRazorpayOrder, verifyRazorpayPayment } = require("../controllers/razorpayController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

// POST /api/v1/payment/create-order
router.post("/create-order", createRazorpayOrder);

// POST /api/v1/payment/verify
router.post("/verify", verifyRazorpayPayment);

module.exports = router;
