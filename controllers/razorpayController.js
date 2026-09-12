const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay Order (before opening checkout)
// @route   POST /api/v1/payment/create-order
// @access  Private
const createRazorpayOrder = async (req, res) => {
  try {
    const { amountInRupees, currency = "INR", receipt } = req.body;

    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    const options = {
      amount: Math.round(amountInRupees * 100),
      currency,
      receipt: receipt || ("receipt_" + Date.now()),
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Razorpay create order error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify Razorpay Payment Signature
// @route   POST /api/v1/payment/verify
// @access  Private
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment verification fields" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed. Invalid signature." });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (error) {
    console.error("Razorpay verify error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createRazorpayOrder, verifyRazorpayPayment };
