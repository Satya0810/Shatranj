import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { verifyToken, getTokenFromRequest } from '../../../lib/auth';
import { fetchChesscomUser } from '../../../lib/chesscomDatabase';

export async function POST(req) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { chesscomUsername } = body;

    if (!chesscomUsername) {
      return NextResponse.json({ error: 'Chess.com username is required' }, { status: 400 });
    }

    // Verify Chess.com username exists
    try {
      await fetchChesscomUser(chesscomUsername);
    } catch (err) {
      return NextResponse.json({ error: 'Chess.com user not found' }, { status: 404 });
    }

    await connectDB();

    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.chesscomUsername = chesscomUsername;
    await user.save();

    return NextResponse.json({ success: true, chesscomUsername });
  } catch (error) {
    console.error('Link Chess.com error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
