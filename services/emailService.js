const nodemailer = require('nodemailer');
const dns = require('dns');
const https = require('https');

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

/**
 * Configure Gmail Transporter with environment credentials
 */
function getTransporter() {
  const user = process.env.GMAIL_USER ? process.env.GMAIL_USER.trim() : null;
  const pass = process.env.GMAIL_PASS ? process.env.GMAIL_PASS.replace(/\s+/g, '') : null;

  if (!user || !pass || user.includes('your_email') || pass.includes('xxxx')) {
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { family: 4 }, (err, address, family) => {
        callback(err, address, family);
      });
    },
  });
}

/**
 * Helper to send email via Brevo HTTPS REST API (Port 443 - Cloud Safe)
 */
function sendViaBrevoHttps(to, subject, html, fromName = 'Kechi') {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return resolve(false);

    const senderEmail = process.env.BREVO_SENDER || 'support.kechi@gmail.com';

    const payload = JSON.stringify({
      sender: { name: fromName, email: senderEmail },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
    });

    const req = https.request('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Email sent to ${to} via Brevo HTTPS API!`);
          resolve(true);
        } else {
          console.error(`❌ Brevo API returned status ${res.statusCode}:`, body);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Brevo HTTPS Request Error:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Helper to send email via Resend HTTPS REST API (Port 443 - Cloud Safe)
 */
function sendViaResendHttps(to, subject, html, fromName = 'Kechi') {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return resolve(false);

    const payload = JSON.stringify({
      from: `${fromName} <onboarding@resend.dev>`,
      to: [to],
      subject: subject,
      html: html,
    });

    const req = https.request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Email sent to ${to} via Resend HTTPS API!`);
          resolve(true);
        } else {
          console.error(`❌ Resend API returned status ${res.statusCode}:`, body);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Resend HTTPS Request Error:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Unified Dispatcher: Tries Brevo HTTPS -> Resend HTTPS -> Gmail SMTP
 */
async function sendUnifiedEmail({ to, subject, html, fromName = 'Kechi' }) {
  // 1. Try Brevo HTTPS API first (sends to any recipient email without custom domain requirement)
  if (process.env.BREVO_API_KEY) {
    const brevoOk = await sendViaBrevoHttps(to, subject, html, fromName);
    if (brevoOk) return true;
  }

  // 2. Try Resend HTTPS API (sends over HTTPS port 443)
  if (process.env.RESEND_API_KEY) {
    const resendOk = await sendViaResendHttps(to, subject, html, fromName);
    if (resendOk) return true;
  }

  // 3. Fallback to Gmail SMTP with IPv4
  const transporter = getTransporter();
  if (transporter) {
    try {
      console.log(`📧 Sending email to ${to} via Gmail SMTP...`);
      const info = await transporter.sendMail({
        from: `"${fromName}" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
      console.log(`✅ SMTP Email sent: ${info.messageId}`);
      return true;
    } catch (smtpErr) {
      console.error('❌ SMTP Error:', smtpErr.message);
      return false;
    }
  }

  return false;
}

/**
 * Send 6-Digit OTP Email
 */
async function sendOtpEmail(userEmail, otpCode, purpose = 'verification') {
  try {
    const cleanEmail = userEmail.toLowerCase().trim();
    const purposeTitle =
      purpose === 'password_reset'
        ? 'Password Reset Request'
        : 'Verify Your Email Address';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
            <div style="font-size: 26px; font-weight: 800; letter-spacing: 2px; color: #111827; text-transform: uppercase;">Kechi</div>
            <div style="font-size: 11px; font-weight: 600; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase; margin-top: 4px;">Premium Poster Prints</div>
          </div>

          <div style="padding: 32px;">
            <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">${purposeTitle}</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
              Please use the verification code below to complete your request. For security reasons, this code will expire in <strong>10 minutes</strong>.
            </p>

            <div style="text-align: center; margin: 28px 0;">
              <div style="display: inline-block; background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 14px 28px; border-radius: 8px;">
                <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">${otpCode}</span>
              </div>
            </div>

            <p style="font-size: 13px; line-height: 1.5; color: #6b7280; margin: 24px 0 0 0;">
              If you did not request this verification code, please disregard this email. Your account remains secure.
            </p>
          </div>

          <div style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
              Kechi Studio • Customer Support: <a href="mailto:support.kechi@gmail.com" style="color: #4b5563; text-decoration: none;">support.kechi@gmail.com</a><br/>
              © ${new Date().getFullYear()} Kechi. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendUnifiedEmail({
      to: cleanEmail,
      subject: `Kechi verification code: ${otpCode}`,
      html,
      fromName: 'Kechi',
    });
  } catch (error) {
    console.error('❌ sendOtpEmail Exception:', error.message);
    return false;
  }
}

/**
 * Send Login Notification / Security Alert Email
 */
async function sendLoginNotificationEmail(userEmail, userName, clientInfo = {}) {
  try {
    const cleanEmail = userEmail.toLowerCase().trim();
    const timeString = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
            <div style="font-size: 26px; font-weight: 800; letter-spacing: 2px; color: #111827; text-transform: uppercase;">Kechi</div>
          </div>

          <div style="padding: 32px;">
            <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">New Account Sign-In</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 20px 0;">
              Hello <strong>${userName || 'Valued Customer'}</strong>,<br/>
              A new sign-in was recorded for your Kechi account.
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6;">
              <tr>
                <td style="padding: 12px 16px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6; width: 35%;">Date & Time</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${timeString} (IST)</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Device Platform</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${clientInfo.platform || 'Android Mobile App'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-size: 13px; color: #6b7280;">Account Email</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #111827;">${cleanEmail}</td>
              </tr>
            </table>

            <p style="font-size: 13px; line-height: 1.5; color: #6b7280; margin: 20px 0 0 0;">
              If this was you, no action is needed. If you did not authorize this access, please change your password immediately or reach out to support.
            </p>
          </div>

          <div style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
              Kechi Security • <a href="mailto:support.kechi@gmail.com" style="color: #4b5563; text-decoration: none;">support.kechi@gmail.com</a><br/>
              © ${new Date().getFullYear()} Kechi. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendUnifiedEmail({
      to: cleanEmail,
      subject: `Security notice: New sign-in to your Kechi account`,
      html,
      fromName: 'Kechi Security',
    });
  } catch (error) {
    console.error('❌ sendLoginNotificationEmail Exception:', error.message);
    return false;
  }
}

/**
 * Send Welcome Email on New Registration
 */
async function sendWelcomeEmail(userEmail, userName) {
  try {
    const cleanEmail = userEmail.toLowerCase().trim();
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
            <div style="font-size: 26px; font-weight: 800; letter-spacing: 2px; color: #111827; text-transform: uppercase;">Kechi</div>
            <div style="font-size: 11px; font-weight: 600; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase; margin-top: 4px;">Print It. Frame It. Love It.</div>
          </div>

          <div style="padding: 32px; text-align: center;">
            <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Welcome to Kechi</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
              Hello <strong>${userName || 'Friend'}</strong>,<br/>
              Thank you for creating an account with Kechi. Discover premium custom posters, museum-grade canvas finishes, and prompt doorstep delivery.
            </p>

            <div style="margin: 28px 0;">
              <span style="display: inline-block; background-color: #111827; color: #ffffff; padding: 12px 30px; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">
                Explore Collection in App
              </span>
            </div>

            <p style="font-size: 13px; line-height: 1.5; color: #6b7280; margin: 0;">
              If you have any questions or custom printing requirements, our team is always here to assist.
            </p>
          </div>

          <div style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
              Customer Support: <a href="mailto:support.kechi@gmail.com" style="color: #4b5563; text-decoration: none;">support.kechi@gmail.com</a><br/>
              © ${new Date().getFullYear()} Kechi. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendUnifiedEmail({
      to: cleanEmail,
      subject: `Welcome to Kechi`,
      html,
      fromName: 'Kechi',
    });
  } catch (error) {
    console.error('❌ sendWelcomeEmail Exception:', error.message);
    return false;
  }
}

/**
 * Send Gmail notification to user on order placement
 */
async function sendGmailOrderNotification(userEmail, orderData) {
  try {
    const cleanEmail = userEmail.toLowerCase().trim();
    const { _id, orderId, trackingCode, grandTotal, items, deliveryAddress, paymentMethod } = orderData;
    const finalId = trackingCode || orderId || _id || 'KCH-1001';

    const itemsHtml = (items || [])
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px 14px; font-size: 13px; color: #111827; border-bottom: 1px solid #f3f4f6;">
            <strong>Poster (${item.size || 'A4'})</strong>
            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Qty: ${item.quantity || 1}</div>
          </td>
          <td style="padding: 12px 14px; font-size: 13px; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6; text-align: right;">
            ₹${item.totalPrice || 0}
          </td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
            <div style="font-size: 26px; font-weight: 800; letter-spacing: 2px; color: #111827; text-transform: uppercase;">Kechi</div>
            <div style="font-size: 11px; font-weight: 600; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase; margin-top: 4px;">Order Confirmation & Receipt</div>
          </div>

          <div style="padding: 32px;">
            <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">Thank you for your order</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 20px 0;">
              Hello <strong>${deliveryAddress?.name || 'Valued Customer'}</strong>,<br/>
              Your order has been confirmed and is now being queued for high-definition printing.
            </p>

            <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="font-size: 13px; color: #6b7280; padding-bottom: 6px;">Order Reference:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right; padding-bottom: 6px;">${finalId}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #6b7280; padding-bottom: 6px;">Payment Method:</td>
                  <td style="font-size: 13px; font-weight: 600; color: #111827; text-align: right; padding-bottom: 6px;">${paymentMethod || 'Online Payment'}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #6b7280;">Estimated Delivery:</td>
                  <td style="font-size: 13px; font-weight: 600; color: #111827; text-align: right;">2 - 4 Business Days</td>
                </tr>
              </table>
            </div>

            <div style="margin: 24px 0 12px 0; font-size: 14px; font-weight: 700; color: #111827;">Order Details</div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #f3f4f6; border-radius: 8px;">
              <thead>
                <tr style="background-color: #f9fafb; text-align: left;">
                  <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Item</th>
                  <th style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 14px; font-size: 14px; font-weight: 700; color: #111827;">Total Paid</td>
                  <td style="padding: 14px; font-size: 16px; font-weight: 800; color: #111827; text-align: right;">₹${grandTotal}</td>
                </tr>
              </tbody>
            </table>

            <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6;">
              <div style="font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 6px;">Delivery Address</div>
              <div style="font-size: 13px; line-height: 1.5; color: #4b5563;">
                ${deliveryAddress?.name || ''}<br/>
                ${deliveryAddress?.addressLine || ''}, ${deliveryAddress?.city || ''} - ${deliveryAddress?.pincode || ''}<br/>
                Contact: ${deliveryAddress?.phone || ''}
              </div>
            </div>
          </div>

          <div style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
              Questions about your order? Contact <a href="mailto:support.kechi@gmail.com" style="color: #4b5563; text-decoration: none;">support.kechi@gmail.com</a><br/>
              © ${new Date().getFullYear()} Kechi. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendUnifiedEmail({
      to: cleanEmail,
      subject: `Order confirmed: #${finalId}`,
      html,
      fromName: 'Kechi Orders',
    });
  } catch (error) {
    console.error('❌ sendGmailOrderNotification Exception:', error.message);
    return false;
  }
}

/**
 * Send Order Status Update Email (Shipped / Delivered / Cancelled)
 */
async function sendOrderStatusEmail(userEmail, orderData, newStatus) {
  try {
    const cleanEmail = userEmail.toLowerCase().trim();
    const { _id, orderId, trackingCode, grandTotal, deliveryAddress } = orderData;
    const finalId = trackingCode || orderId || _id || 'KCH-1001';

    let statusHeading = `Order Status: ${newStatus}`;
    let statusMessage = `Your Kechi order #${finalId} status has been updated to: ${newStatus}.`;

    if (newStatus === 'Shipped') {
      statusHeading = 'Your Order Has Shipped';
      statusMessage = `Your order #${finalId} has been dispatched and is currently in transit to your delivery address.`;
    } else if (newStatus === 'Delivered') {
      statusHeading = 'Order Delivered';
      statusMessage = `Your order #${finalId} has been successfully delivered. Thank you for choosing Kechi.`;
    } else if (newStatus === 'Cancelled') {
      statusHeading = 'Order Cancelled';
      statusMessage = `Your order #${finalId} has been cancelled. Any pre-authorized charges will be refunded to your original payment method within 3 to 5 business days.`;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
            <div style="font-size: 26px; font-weight: 800; letter-spacing: 2px; color: #111827; text-transform: uppercase;">Kechi</div>
            <div style="font-size: 11px; font-weight: 600; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase; margin-top: 4px;">Shipment Update</div>
          </div>

          <div style="padding: 32px;">
            <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 12px 0;">${statusHeading}</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 20px 0;">
              Hello <strong>${deliveryAddress?.name || 'Valued Customer'}</strong>,<br/>
              ${statusMessage}
            </p>

            <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="font-size: 13px; color: #6b7280; padding-bottom: 6px;">Order Reference:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right; padding-bottom: 6px;">${finalId}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #6b7280; padding-bottom: 6px;">Current Status:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right; padding-bottom: 6px;">${newStatus}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #6b7280;">Order Total:</td>
                  <td style="font-size: 13px; font-weight: 600; color: #111827; text-align: right;">₹${grandTotal || 0}</td>
                </tr>
              </table>
            </div>
          </div>

          <div style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
              Customer Support: <a href="mailto:support.kechi@gmail.com" style="color: #4b5563; text-decoration: none;">support.kechi@gmail.com</a><br/>
              © ${new Date().getFullYear()} Kechi. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendUnifiedEmail({
      to: cleanEmail,
      subject: `Order update: #${finalId} is ${newStatus}`,
      html,
      fromName: 'Kechi Orders',
    });
  } catch (error) {
    console.error('❌ sendOrderStatusEmail Exception:', error.message);
    return false;
  }
}

/**
 * Send Instant Notification Email to Store Owner (Admin) when an order is placed
 */
async function sendAdminNewOrderAlert(orderData) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.BREVO_SENDER || 'support.kechi@gmail.com';
    const { _id, orderId, trackingCode, grandTotal, paymentMethod, paymentStatus, items, deliveryAddress, userName, userEmail } = orderData;
    const finalId = trackingCode || orderId || _id || 'KCH-1001';

    const itemsHtml = (items || [])
      .map(
        (item, index) => `
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 85px; vertical-align: top;">
                <img src="${item.imageUrl}" alt="Poster" style="width: 75px; height: 105px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb;" />
              </td>
              <td style="vertical-align: top; padding-left: 14px;">
                <div style="font-size: 14px; font-weight: 700; color: #111827;">Item #${index + 1}: Custom Poster</div>
                <div style="font-size: 13px; color: #4b5563; margin-top: 4px;"><strong>Size:</strong> ${item.size || 'A4'}</div>
                <div style="font-size: 13px; color: #4b5563; margin-top: 2px;"><strong>Quantity:</strong> ${item.quantity || 1}</div>
                <div style="font-size: 13px; color: #4b5563; margin-top: 2px;"><strong>Price:</strong> ₹${item.totalPrice || 0}</div>
                <div style="margin-top: 10px;">
                  <a href="${item.imageUrl}" target="_blank" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                    Download Print File
                  </a>
                </div>
              </td>
            </tr>
          </table>
        </div>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 0; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="background-color: #111827; color: #ffffff; padding: 20px 24px;">
            <div style="font-size: 18px; font-weight: 700;">New Order Received</div>
            <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">Order #${finalId} • ₹${grandTotal} (${paymentMethod})</div>
          </div>

          <div style="padding: 24px;">
            <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 12px;">Customer & Shipping Information</div>
            <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="color: #6b7280; padding: 4px 0; width: 35%;">Customer Name:</td>
                  <td style="color: #111827; font-weight: 600; padding: 4px 0;">${deliveryAddress?.name || userName || 'Customer'}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; padding: 4px 0;">Phone:</td>
                  <td style="color: #111827; font-weight: 600; padding: 4px 0;">${deliveryAddress?.phone || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; padding: 4px 0;">Email:</td>
                  <td style="color: #111827; font-weight: 600; padding: 4px 0;">${userEmail || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; padding: 4px 0; vertical-align: top;">Shipping Address:</td>
                  <td style="color: #111827; line-height: 1.4; padding: 4px 0;">${deliveryAddress?.addressLine || ''}, ${deliveryAddress?.city || ''}, ${deliveryAddress?.state || ''} - <strong>${deliveryAddress?.pincode || ''}</strong></td>
                </tr>
                <tr>
                  <td style="color: #6b7280; padding: 4px 0;">Payment:</td>
                  <td style="color: #111827; font-weight: 600; padding: 4px 0;">${paymentMethod} (${paymentStatus || 'Confirmed'})</td>
                </tr>
              </table>
            </div>

            <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 12px;">Print Items (${(items || []).length}):</div>
            ${itemsHtml}
          </div>

          <div style="padding: 16px 24px; background-color: #fafafa; border-top: 1px solid #f3f4f6; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #9ca3af;">
              Kechi Merchant Fulfillment Notification
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendUnifiedEmail({
      to: adminEmail,
      subject: `[New Order] #${finalId} from ${deliveryAddress?.name || userName || 'Customer'} (₹${grandTotal})`,
      html,
      fromName: 'Kechi Admin Alert',
    });
  } catch (error) {
    console.error('❌ sendAdminNewOrderAlert Exception:', error.message);
    return false;
  }
}

module.exports = {
  sendOtpEmail,
  sendLoginNotificationEmail,
  sendWelcomeEmail,
  sendGmailOrderNotification,
  sendOrderStatusEmail,
  sendAdminNewOrderAlert,
};
