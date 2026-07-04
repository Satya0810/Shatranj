import nodemailer from 'nodemailer';

let transporter = null;

// Initialize the transporter
async function initTransporter() {
  if (transporter) return transporter;

  // Use real SMTP if provided in environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  console.log('No SMTP credentials found. Skipping real email sending.');
  return null;
}

export async function sendVerificationEmail(to, otp) {
  const mailer = await initTransporter();

  if (!mailer) {
    console.log('✉️ MOCK EMAIL SENT (Verification OTP):', otp);
    return { mock: true, otp };
  }

  const info = await mailer.sendMail({
    from: '"ChessMaster" <noreply@chessmaster.local>',
    to,
    subject: "Verify your email address - ChessMaster",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; text-align: center;">
        <h2 style="color: #6ab04c;">Welcome to ChessMaster! ♞</h2>
        <p>Thank you for signing up. Please verify your email address by entering the following OTP:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return info;
}

export async function sendPasswordResetEmail(to, otp) {
  const mailer = await initTransporter();

  if (!mailer) {
    console.log('✉️ MOCK EMAIL SENT (Password Reset OTP):', otp);
    return { mock: true, otp };
  }

  const info = await mailer.sendMail({
    from: '"ChessMaster" <noreply@chessmaster.local>',
    to,
    subject: "Password Reset Request - ChessMaster",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; text-align: center;">
        <h2 style="color: #4a8cdb;">Password Reset 🔒</h2>
        <p>We received a request to reset your password. Enter the following OTP to proceed:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
      </div>
    `,
  });

  return info;
}
