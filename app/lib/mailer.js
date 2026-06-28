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
  } else {
    // Generate a test account on the fly using Ethereal (fake SMTP service for developers)
    console.log('No SMTP credentials found. Generating Ethereal test account...');
    let testAccount = await nodemailer.createTestAccount();
    
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return transporter;
}

export async function sendVerificationEmail(to, otp) {
  const mailer = await initTransporter();

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

  // If using Ethereal, log the preview URL so the developer can see the email in their console!
  if (info.messageId && info.response.includes('ethereal')) {
    console.log('----------------------------------------------------');
    console.log('✉️ TEST EMAIL SENT (Verification OTP):', otp);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    console.log('----------------------------------------------------');
  }

  return info;
}

export async function sendPasswordResetEmail(to, otp) {
  const mailer = await initTransporter();

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

  if (info.messageId && info.response.includes('ethereal')) {
    console.log('----------------------------------------------------');
    console.log('✉️ TEST EMAIL SENT (Password Reset OTP):', otp);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    console.log('----------------------------------------------------');
  }

  return info;
}
