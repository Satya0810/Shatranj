import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { verifyToken, getTokenFromRequest } from '../../../lib/auth';
import { fetchLichessUser } from '../../../lib/lichessDatabase';

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
    const { lichessUsername } = body;

    if (!lichessUsername) {
      return NextResponse.json({ error: 'Lichess username is required' }, { status: 400 });
    }

    // Verify Lichess username exists
    try {
      await fetchLichessUser(lichessUsername);
    } catch (err) {
      return NextResponse.json({ error: 'Lichess user not found' }, { status: 404 });
    }

    await connectDB();

    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.lichessUsername = lichessUsername;
    await user.save();

    return NextResponse.json({ success: true, lichessUsername });
  } catch (error) {
    console.error('Link Lichess error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
