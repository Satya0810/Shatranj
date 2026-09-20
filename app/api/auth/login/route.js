import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { comparePassword, signToken } from '../../../lib/auth';
import Session from '../../../models/Session';
import { checkRateLimit } from '../../../lib/rateLimit';

export async function POST(req) {
  try {
    // 1. Rate limiting: max 10 attempts per minute
    const rateCheck = checkRateLimit(req, { limit: 10, windowMs: 60000, keyPrefix: 'auth_login' });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${rateCheck.resetSeconds} seconds.` },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.resetSeconds) }
        }
      );
    }

    await connectDB();
    
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Valid email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.isVerified) {
      return NextResponse.json({ 
        error: 'Please verify your email first', 
        requires_verification: true 
      }, { status: 403 });
    }

    // Compare password
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Create session
    const userAgent = req.headers.get('user-agent') || 'Unknown Device';
    const ipAddress = req.headers.get('x-forwarded-for') || 'Unknown IP';
    const session = await Session.create({
      userId: user._id,
      userAgent,
      ipAddress
    });

    // Generate token
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
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
