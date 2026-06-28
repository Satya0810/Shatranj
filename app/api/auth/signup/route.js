import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { hashPassword } from '../../../lib/auth';
import { sendVerificationEmail } from '../../../lib/mailer';

export async function POST(req) {
  try {
    await connectDB();
    
    const { username, email, password } = await req.json();

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    let existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      // If they exist but aren't verified, allow them to re-signup or resend OTP
      if (!existingUser.isVerified && existingUser.email === email) {
        // We can just resend the OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        existingUser.verificationOTP = otp;
        existingUser.verificationOTPExpires = new Date(Date.now() + 15 * 60 * 1000);
        await existingUser.save();
        
        await sendVerificationEmail(email, otp);
        return NextResponse.json({ requires_verification: true, message: 'OTP resent' }, { status: 200 });
      }

      if (existingUser.email === email) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const user = await User.create({
      username,
      email,
      passwordHash,
      isVerified: false,
      verificationOTP: otp,
      verificationOTPExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    // Send verification email
    await sendVerificationEmail(email, otp);

    return NextResponse.json({
      requires_verification: true,
      message: 'Verification OTP sent'
    }, { status: 201 });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

