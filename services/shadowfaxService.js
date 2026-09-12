const axios = require("axios");

const SHADOWFAX_BASE_URL = process.env.SHADOWFAX_BASE_URL || "https://staging.shadowfax.in";
const SHADOWFAX_API_KEY = process.env.SHADOWFAX_API_KEY;
const SHADOWFAX_STORE_CODE = process.env.SHADOWFAX_STORE_CODE || "KECHI_MAIN_WAREHOUSE";

/**
 * Check if Shadowfax is in live/configured mode or fallback mock mode
 */
const isConfigured = () => {
  return SHADOWFAX_API_KEY && !SHADOWFAX_API_KEY.includes("YOUR_") && SHADOWFAX_API_KEY.trim() !== "";
};

/**
 * 1. Check Serviceability for a Delivery Pincode
 */
const checkServiceability = async (deliveryPincode) => {
  if (!isConfigured()) {
    // Development fallback mock
    return {
      success: true,
      serviceable: true,
      pincode: deliveryPincode,
      codAvailable: true,
      isMock: true,
      estimatedDays: "3-5 business days"
    };
  }

  try {
    const res = await axios.get(`${SHADOWFAX_BASE_URL}/api/v3/serviceability`, {
      params: { pincode: deliveryPincode },
      headers: {
        Authorization: `Bearer ${SHADOWFAX_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    return {
      success: true,
      serviceable: res.data?.serviceable ?? true,
      pincode: deliveryPincode,
      codAvailable: res.data?.cod_available ?? true,
      raw: res.data
    };
  } catch (error) {
    console.error("Shadowfax serviceability error:", error.response?.data || error.message);
    return {
      success: false,
      serviceable: false,
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * 2. Create Shipment & Generate Waybill (AWB)
 */
const createShipment = async (order) => {
  const isPrepaid = order.paymentMethod !== "Cash on Delivery";
  const orderId = order._id.toString();

  if (!isConfigured()) {
    // Generate realistic development AWB tracking code
    const mockWaybill = "SFX" + Math.floor(1000000000 + Math.random() * 9000000000);
    return {
      success: true,
      isMock: true,
      waybillNumber: mockWaybill,
      shadowfaxOrderId: `SFX_ORD_${orderId.substring(18)}`,
      trackingUrl: `https://tracker.shadowfax.in/track?orderId=${mockWaybill}`,
      shippingLabelUrl: `https://shadowfax.in/mock-labels/${mockWaybill}.pdf`
    };
  }

  try {
    const payload = {
      order_details: {
        client_order_id: orderId,
        actual_weight: 0.5, // 500 grams standard poster tube/packaging
        order_type: isPrepaid ? "PREPAID" : "COD",
        total_amount: order.grandTotal,
        collectible_amount: isPrepaid ? 0 : order.grandTotal,
        product_desc: "Kechi Designer Posters Print Tube"
      },
      customer_details: {
        name: order.deliveryAddress.name,
        contact: order.deliveryAddress.phone,
        address_line_1: order.deliveryAddress.addressLine,
        city: order.deliveryAddress.city,
        state: order.deliveryAddress.state,
        pincode: order.deliveryAddress.pincode
      },
      pickup_details: {
        store_code: SHADOWFAX_STORE_CODE
      }
    };

    const res = await axios.post(`${SHADOWFAX_BASE_URL}/api/v3/orders/`, payload, {
      headers: {
        Authorization: `Bearer ${SHADOWFAX_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const data = res.data;
    const waybill = data?.data?.waybill_number || data?.waybill_number;

    return {
      success: true,
      waybillNumber: waybill,
      shadowfaxOrderId: data?.data?.sfx_order_id || data?.sfx_order_id || orderId,
      trackingUrl: `https://tracker.shadowfax.in/track?orderId=${waybill}`,
      shippingLabelUrl: data?.data?.label_url || null,
      raw: data
    };
  } catch (error) {
    console.error("Shadowfax createShipment error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to generate Shadowfax shipment");
  }
};

/**
 * 3. Track Shipment Status
 */
const trackShipment = async (waybillNumber) => {
  if (!isConfigured()) {
    return {
      success: true,
      isMock: true,
      waybillNumber,
      status: "In Transit",
      courier: "Shadowfax Express",
      currentLocation: "Regional Delivery Hub",
      estimatedDelivery: "2-3 Days"
    };
  }

  try {
    const res = await axios.get(`${SHADOWFAX_BASE_URL}/api/v3/orders/track`, {
      params: { waybill_number: waybillNumber },
      headers: {
        Authorization: `Bearer ${SHADOWFAX_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    return {
      success: true,
      data: res.data
    };
  } catch (error) {
    console.error("Shadowfax trackShipment error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * 4. Cancel Shipment
 */
const cancelShipment = async (orderId) => {
  if (!isConfigured()) {
    return { success: true, isMock: true, message: "Mock Shadowfax shipment cancelled." };
  }

  try {
    const res = await axios.post(`${SHADOWFAX_BASE_URL}/api/v3/orders/${orderId}/cancel`, {}, {
      headers: {
        Authorization: `Bearer ${SHADOWFAX_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    return { success: true, data: res.data };
  } catch (error) {
    console.error("Shadowfax cancelShipment error:", error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

module.exports = {
  checkServiceability,
  createShipment,
  trackShipment,
  cancelShipment,
  isConfigured
};
