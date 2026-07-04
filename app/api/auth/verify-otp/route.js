import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { signToken } from '../../../lib/auth';
import Session from '../../../models/Session';

export async function POST(req) {
  try {
    await connectDB();
    
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({ error: 'User is already verified' }, { status: 400 });
    }

    if (user.verificationOTP !== otp) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    if (user.verificationOTPExpires < Date.now()) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // OTP is valid, verify user
    user.isVerified = true;
    user.verificationOTP = undefined;
    user.verificationOTPExpires = undefined;
    await user.save();

    const userAgent = req.headers.get('user-agent') || 'Unknown Device';
    const ipAddress = req.headers.get('x-forwarded-for') || 'Unknown IP';
    const session = await Session.create({
      userId: user._id,
      userAgent,
      ipAddress
    });

    // Generate token and log them in
    const token = signToken(user._id, session._id);

    return NextResponse.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        rating: user.rating,
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        chesscomUsername: user.chesscomUsername,
        lichessUsername: user.lichessUsername,
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
