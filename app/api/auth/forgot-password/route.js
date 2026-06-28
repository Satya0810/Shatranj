import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { sendPasswordResetEmail } from '../../../lib/mailer';

export async function POST(req) {
  try {
    await connectDB();
    
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await User.findOne({ email });

    // We don't want to leak whether an email exists, so we always return 200
    // But internally we only send an email if the user exists
    if (user) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.resetOTP = otp;
      user.resetOTPExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await user.save();

      await sendPasswordResetEmail(email, otp);
    }

    return NextResponse.json({
      message: 'If an account with that email exists, we have sent a password reset OTP.'
    }, { status: 200 });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
