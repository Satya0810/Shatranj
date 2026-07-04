import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import Message from '../../../models/Message';
import { verifyToken } from '../../../lib/auth';

export async function GET(req, { params }) {
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

    const { friendId } = await params;
    if (!friendId) {
      return NextResponse.json({ error: 'Friend ID is required' }, { status: 400 });
    }

    // Fetch messages between currentUser and friendId
    // Sorting oldest to newest
    const messages = await Message.find({
      $or: [
        { senderId: decoded.userId, receiverId: friendId },
        { senderId: friendId, receiverId: decoded.userId }
      ]
    }).sort({ createdAt: 1 }).limit(100);

    // Optionally mark messages as read
    await Message.updateMany(
      { senderId: friendId, receiverId: decoded.userId, read: false },
      { $set: { read: true } }
    );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Fetch chat history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
