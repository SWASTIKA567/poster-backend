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

    const senderEmail = process.env.GMAIL_USER || 'support@kechi.app';

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
        : 'Account Verification Code';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; padding: 28px; border: 1px solid #f0f0f0; border-radius: 16px;">
        <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #8B0000;">
          <h1 style="color: #8B0000; margin: 0; font-size: 32px; letter-spacing: -1px;">Kechi</h1>
          <p style="color: #C9A227; margin: 4px 0 0 0; font-size: 13px; font-weight: bold; letter-spacing: 1px;">PRINT IT. FRAME IT. LOVE IT.</p>
        </div>

        <div style="padding: 24px 0; text-align: center;">
          <h2 style="color: #1a1a1a; margin-top: 0; font-size: 20px;">${purposeTitle}</h2>
          <p style="color: #555; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
            Use the 6-digit verification code below to proceed with your request. This code is valid for <strong>10 minutes</strong>.
          </p>

          <div style="background: #FFF5F5; border: 2px dashed #8B0000; padding: 18px; border-radius: 12px; display: inline-block; min-width: 200px;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #8B0000; font-family: monospace;">${otpCode}</span>
          </div>

          <p style="color: #888; font-size: 12px; margin-top: 24px; line-height: 1.4;">
            If you didn't request this code, please ignore this email or contact support if you suspect unauthorized activity.
          </p>
        </div>

        <div style="text-align: center; color: #aaa; font-size: 11px; border-top: 1px solid #eee; padding-top: 16px;">
          © ${new Date().getFullYear()} Kechi Inc. All rights reserved.
        </div>
      </div>
    `;

    return await sendUnifiedEmail({
      to: cleanEmail,
      subject: `🔐 Your Kechi OTP: ${otpCode}`,
      html,
      fromName: 'Kechi Security',
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
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; padding: 28px; border: 1px solid #f0f0f0; border-radius: 16px;">
        <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #8B0000;">
          <h1 style="color: #8B0000; margin: 0; font-size: 32px; letter-spacing: -1px;">Kechi</h1>
        </div>

        <div style="padding: 24px 0;">
          <h2 style="color: #1a1a1a; margin-top: 0; font-size: 20px;">New Sign-In Detected</h2>
          <p style="color: #555; font-size: 14px; line-height: 1.5;">
            Hi <strong>${userName || 'Poster Maker'}</strong>,<br/>
            A new sign-in was just recorded for your Kechi account.
          </p>

          <div style="background: #fafafa; padding: 16px; border-radius: 10px; border-left: 4px solid #10B981; margin: 18px 0;">
            <p style="margin: 0 0 6px 0; color: #333; font-size: 13px;"><strong>Date & Time:</strong> ${timeString} (IST)</p>
            <p style="margin: 0 0 6px 0; color: #333; font-size: 13px;"><strong>Platform:</strong> ${clientInfo.platform || 'Mobile App / Android'}</p>
            <p style="margin: 0; color: #333; font-size: 13px;"><strong>Account Email:</strong> ${cleanEmail}</p>
          </div>

          <p style="color: #777; font-size: 12px; line-height: 1.4;">
            If this was you, no action is needed! If you did not sign in, please secure your account immediately or contact us.
          </p>
        </div>

        <div style="text-align: center; color: #aaa; font-size: 11px; border-top: 1px solid #eee; padding-top: 16px;">
          © ${new Date().getFullYear()} Kechi Inc. • <a href="mailto:support@kechi.app" style="color: #8B0000; text-decoration: none;">support@kechi.app</a>
        </div>
      </div>
    `;

    return await sendUnifiedEmail({
      to: cleanEmail,
      subject: `🔔 New Sign-In to Your Kechi Account`,
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
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; padding: 28px; border: 1px solid #f0f0f0; border-radius: 16px;">
        <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #8B0000;">
          <h1 style="color: #8B0000; margin: 0; font-size: 32px; letter-spacing: -1px;">Kechi</h1>
          <p style="color: #C9A227; margin: 4px 0 0 0; font-size: 13px; font-weight: bold;">Create • Express • Vibe</p>
        </div>

        <div style="padding: 24px 0; text-align: center;">
          <h2 style="color: #1a1a1a; margin-top: 0; font-size: 22px;">Welcome to the Family! 🎉</h2>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Hey <strong>${userName || 'Friend'}</strong>, we're thrilled to have you here. With Kechi, you can turn your favorite photos, aesthetic art, and inspirational designs into museum-grade premium posters with fast doorstep delivery.
          </p>

          <div style="margin: 24px 0;">
            <span style="display: inline-block; background: #8B0000; color: #ffffff; padding: 12px 28px; border-radius: 24px; font-weight: bold; font-size: 14px;">
              Start Exploring Posters 🖼️
            </span>
          </div>
        </div>

        <div style="text-align: center; color: #aaa; font-size: 11px; border-top: 1px solid #eee; padding-top: 16px;">
          © ${new Date().getFullYear()} Kechi Inc. • <a href="mailto:support@kechi.app" style="color: #8B0000; text-decoration: none;">support@kechi.app</a>
        </div>
      </div>
    `;

    return await sendUnifiedEmail({
      to: cleanEmail,
      subject: `🎨 Welcome to Kechi, ${userName || 'Poster Maker'}!`,
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

    const html = `
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
    `;

    return await sendUnifiedEmail({
      to: cleanEmail,
      subject: `🎉 Kechi Order Confirmed - #${finalId}`,
      html,
      fromName: 'Kechi Orders',
    });
  } catch (error) {
    console.error('❌ sendGmailOrderNotification Exception:', error.message);
    return false;
  }
}

module.exports = {
  sendOtpEmail,
  sendLoginNotificationEmail,
  sendWelcomeEmail,
  sendGmailOrderNotification,
};
