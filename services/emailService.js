const nodemailer = require('nodemailer');

/**
 * Configure Gmail Transporter with environment credentials
 */
function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass || user.includes('your_email') || pass.includes('xxxx')) {
    console.log('⚠️ Gmail SMTP credentials not fully configured in .env');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

/**
 * Send Gmail notification to user on order placement
 */
async function sendGmailOrderNotification(userEmail, orderData) {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.log(`ℹ️ Email payload ready for ${userEmail}`);
      return false;
    }

    const { _id, orderId, trackingCode, grandTotal, items, deliveryAddress } = orderData;
    const finalId = trackingCode || orderId || _id || 'KCH-1001';

    const itemsHtml = (items || [])
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong>Poster (${item.size || 'A4'})</strong> x ${item.quantity || 1}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
            ₹${item.totalPrice || 0}
          </td>
        </tr>
      `
      )
      .join('');

    const mailOptions = {
      from: `"Kechi" <${process.env.GMAIL_USER}>`,
      to: userEmail,
      subject: `🎉 Kechi Order Confirmed - #${finalId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border: 1px solid #eee; border-radius: 16px;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #8B0000;">
            <h1 style="color: #8B0000; margin: 0; font-size: 32px; letter-spacing: -1px;">Kechi</h1>
            <p style="color: #C9A227; margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Print it. Frame it. Love it.</p>
          </div>

          <div style="padding: 24px 0;">
            <h2 style="color: #1a1a1a; margin-top: 0;">Order Confirmed! 🎉</h2>
            <p style="color: #555; line-height: 1.5;">
              Hi <strong>${deliveryAddress?.name || 'Valued Customer'}</strong>,<br/>
              Thank you for ordering with Kechi! Your high-resolution poster is being prepared & sent to printing.
            </p>

            <div style="background: #fdf8e6; padding: 16px; border-radius: 12px; border-left: 4px solid #C9A227; margin: 20px 0;">
              <p style="margin: 0; color: #8B0000; font-weight: bold; font-size: 16px;">Tracking Code: ${finalId}</p>
              <p style="margin: 6px 0 0 0; color: #555; font-size: 13px;">Estimated Delivery: 2 - 4 Business Days</p>
            </div>

            <h3 style="color: #1a1a1a; margin-top: 25px;">Order Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f5f5f5; text-align: left;">
                  <th style="padding: 10px; border-radius: 6px 0 0 6px;">Item</th>
                  <th style="padding: 10px; text-align: right; border-radius: 0 6px 6px 0;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="text-align: right; padding-top: 16px;">
              <h3 style="margin: 0; color: #8B0000; font-size: 20px;">Total Paid: ₹${grandTotal}</h3>
            </div>

            <div style="margin-top: 24px; padding: 16px; background: #fafafa; border-radius: 12px; border: 1px solid #eee;">
              <h4 style="margin: 0 0 6px 0; color: #333;">Shipping Address:</h4>
              <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.5;">
                ${deliveryAddress?.name || ''}<br/>
                ${deliveryAddress?.addressLine || ''}, ${deliveryAddress?.city || ''} - ${deliveryAddress?.pincode || ''}<br/>
                Phone: ${deliveryAddress?.phone || ''}
              </p>
            </div>
          </div>

          <div style="text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 16px; margin-top: 24px;">
            Need help with your order? Reply to this email or contact support at <a href="mailto:support@kechi.app" style="color: #8B0000;">support@kechi.app</a><br/>
            © ${new Date().getFullYear()} Kechi Inc. All rights reserved.
          </div>
        </div>
      `,
    };

    console.log(`📧 Sending Gmail notification to ${userEmail}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Gmail message sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ sendGmailOrderNotification Error:', error.message);
    return false;
  }
}

module.exports = { sendGmailOrderNotification };
