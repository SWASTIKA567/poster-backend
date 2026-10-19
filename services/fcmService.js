const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

let isInitialized = false;

// Initialize Firebase Admin SDK
try {
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // If passed via Render environment variable as JSON string
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isInitialized = true;
    console.log('🔥 Firebase Admin initialized via environment variable.');
  } else if (fs.existsSync(serviceAccountPath)) {
    // If passed via local JSON file
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isInitialized = true;
    console.log('🔥 Firebase Admin initialized via firebase-service-account.json.');
  } else {
    console.log('ℹ️ Firebase Admin Notice: firebase-service-account.json not found. Push notifications will be logged.');
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error.message);
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
