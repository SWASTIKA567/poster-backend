const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

let isInitialized = false;

// Initialize Firebase Admin SDK
try {
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  const getCert = (account) => {
    try {
      if (admin && admin.credential && typeof admin.credential.cert === 'function') {
        return admin.credential.cert(account);
      }
      if (admin && admin.default && admin.default.credential && typeof admin.default.credential.cert === 'function') {
        return admin.default.credential.cert(account);
      }
      const { cert } = require('firebase-admin/app');
      return cert(account);
    } catch (_) {
      return null;
    }
  };

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // If passed via Render environment variable as JSON string
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      const credential = getCert(serviceAccount);
      if (credential) {
        admin.initializeApp({ credential });
        isInitialized = true;
        console.log('🔥 Firebase Admin initialized via environment variable.');
      } else {
        console.log('ℹ️ Firebase Admin Notice: Service account format requires cert credentials. Push fallback active.');
      }
    } catch (parseErr) {
      console.log('ℹ️ Firebase Admin Notice: Invalid JSON in FIREBASE_SERVICE_ACCOUNT. Push fallback active.');
    }
  } else if (fs.existsSync(serviceAccountPath)) {
    // If passed via local JSON file
    try {
      const serviceAccount = require(serviceAccountPath);
      const credential = getCert(serviceAccount);
      if (credential) {
        admin.initializeApp({ credential });
        isInitialized = true;
        console.log('🔥 Firebase Admin initialized via firebase-service-account.json.');
      }
    } catch (_) {}
  } else {
    console.log('ℹ️ Firebase Admin Notice: firebase-service-account.json not configured. Local push notification fallback active.');
  }
} catch (error) {
  console.log('ℹ️ Firebase Admin Notice: Push notifications running in fallback mode.');
}

/**
 * Sends a real-time push notification to a user's phone
 * @param {string} userId - MongoDB User ID
 * @param {object} notification - { title, body, data }
 */
const sendPushToUser = async (userId, { title, body, data = {} }) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.fcmToken) {
      console.log(`[FCM] User ${userId} has no registered FCM push token.`);
      return false;
    }

    if (!isInitialized) {
      console.log(`[FCM Mock] Would send to ${user.name} (${user.email}): "${title}" - "${body}"`);
      return false;
    }

    const message = {
      token: user.fcmToken,
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'kechi_order_updates',
          sound: 'default',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ [FCM] Push Notification delivered to ${user.email}: ${response}`);
    return true;
  } catch (error) {
    console.error('[FCM] Error sending push notification:', error.message);
    return false;
  }
};

module.exports = {
  sendPushToUser,
};
