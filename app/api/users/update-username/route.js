import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';

export async function POST(req) {
  try {
    await connectDB();
    
    // Verify user is authenticated
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { newUsername } = await req.json();

    if (!newUsername || newUsername.trim().length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters long' }, { status: 400 });
    }

    // Check if username is already taken
    const existingUser = await User.findOne({ username: { $regex: new RegExp('^' + newUsername.trim() + '$', 'i') } });
    if (existingUser) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
    }

    // Update the username
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.username = newUsername.trim();
    await user.save();

    return NextResponse.json({ success: true, user: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    console.error('Update username error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
