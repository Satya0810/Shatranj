import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import Session from '../../../models/Session';
import { verifyToken, getTokenFromRequest } from '../../../lib/auth';

export async function GET(req) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    
    // Fetch all active sessions for this user
    const sessions = await Session.find({ userId: decoded.userId }).sort({ lastActive: -1 });

    // Mark the current session so the frontend knows which one it is
    const sessionsWithCurrent = sessions.map(s => {
      const obj = s.toObject();
      obj.isCurrent = obj._id.toString() === decoded.jti;
      return obj;
    });

    return NextResponse.json({ sessions: sessionsWithCurrent }, { status: 200 });

  } catch (error) {
    console.error('Fetch sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
