import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';

export async function POST(req) {
  try {
    await connectDB();
    
    // Authenticate
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { targetUserId, action } = await req.json(); // action can be 'accept' or 'reject'
    if (!targetUserId || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Valid targetUserId and action (accept/reject) are required' }, { status: 400 });
    }

    const currentUser = await User.findById(decoded.userId);
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if the request exists
    const requestIndex = currentUser.friendRequests.indexOf(targetUserId);
    if (requestIndex === -1) {
      return NextResponse.json({ error: 'No friend request from this user' }, { status: 400 });
    }

    // Remove the request from the pending list
    currentUser.friendRequests.splice(requestIndex, 1);

    if (action === 'accept') {
      // Add to friends list if not already there
      if (!currentUser.friends.includes(targetUserId)) {
        currentUser.friends.push(targetUserId);
      }
      
      // Also add currentUser to the target user's friends list
      const targetUser = await User.findById(targetUserId);
      if (targetUser && !targetUser.friends.includes(currentUser._id)) {
        targetUser.friends.push(currentUser._id);
        await targetUser.save();
      }
    }

    await currentUser.save();

    return NextResponse.json({ success: true, message: `Friend request ${action}ed` });
  } catch (error) {
    console.error('Accept/reject friend request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
