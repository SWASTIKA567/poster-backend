const express = require('express');
const router = express.Router();
const {
  placeOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  requestReplacement,
  updateReplacementStatus,
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', placeOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrderById);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/cancel', cancelOrder);
router.post('/:id/replacement', requestReplacement);
router.patch('/:id/replacement-status', updateReplacementStatus);

module.exports = router;
