import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';

export async function GET(req) {
  try {
    await connectDB();
    
    // Authenticate
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Search for users, case-insensitive, limiting to 10
    // Exclude the currently logged in user
    const users = await User.find({
      username: { $regex: new RegExp(q, 'i') },
      _id: { $ne: decoded.userId }
    })
    .select('username rating avatar')
    .limit(10);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Search friends error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
