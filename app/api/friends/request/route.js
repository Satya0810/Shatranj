import { NextResponse } from 'next/server';
import connectDB from '../../../../lib/mongodb';
import User from '../../../../models/User';
import { verifyAuth } from '../../../../lib/auth';

export async function POST(req) {
  try {
    await connectDB();
    
    // Authenticate
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAuth(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 });
    }
    if (targetUserId === decoded.userId) {
      return NextResponse.json({ error: 'You cannot friend yourself' }, { status: 400 });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already friends
    if (targetUser.friends.includes(decoded.userId)) {
      return NextResponse.json({ error: 'Already friends' }, { status: 400 });
    }

    // Check if already requested
    if (targetUser.friendRequests.includes(decoded.userId)) {
      return NextResponse.json({ error: 'Friend request already sent' }, { status: 400 });
    }

    // Add request
    targetUser.friendRequests.push(decoded.userId);
    await targetUser.save();

    return NextResponse.json({ success: true, message: 'Friend request sent' });
  } catch (error) {
    console.error('Send friend request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
