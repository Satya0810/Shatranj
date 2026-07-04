import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { signToken } from '../../../lib/auth';

export async function POST(req) {
  try {
    const { credential, mode } = await req.json();

    if (!credential) {
      return NextResponse.json({ error: 'Google credential is required' }, { status: 400 });
    }

    // Decode the Google JWT token (the payload is the middle part)
    // We verify using Google's tokeninfo endpoint
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!googleRes.ok) {
      return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
    }

    const googleUser = await googleRes.json();
    const { email, name, sub: googleId, picture } = googleUser;

    if (!email) {
      return NextResponse.json({ error: 'Could not get email from Google' }, { status: 400 });
    }

    await connectDB();

    // Check if user already exists with this email
    let user = await User.findOne({ email });

    if (!user) {
      // New user — create account
      // Generate a unique username from the Google name
      let username = (name || email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 15);
      
      // Check if username is taken and make it unique
      let existing = await User.findOne({ username });
      while (existing) {
        username = username.substring(0, 14) + '_' + Math.random().toString(36).substring(2, 6);
        existing = await User.findOne({ username });
      }

      user = await User.create({
        username,
        email,
        passwordHash: 'google_oauth_' + googleId, // No password for Google users
        avatar: picture || null,
        isVerified: true, // Google accounts are pre-verified
      });
    } else {
      // User exists — log them in
      if (picture && !user.avatar) {
        user.avatar = picture;
        await user.save();
      }
    }

    const token = signToken(user._id);

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
        avatar: user.avatar,
        chesscomUsername: user.chesscomUsername,
        lichessUsername: user.lichessUsername,
      }
    });

  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
