import { NextResponse } from 'next/server';
import connectDB from '../../../../lib/mongodb';
import Session from '../../../../models/Session';
import { verifyToken, getTokenFromRequest } from '../../../../lib/auth';

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    
    if (!id) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

    const token = getTokenFromRequest(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    
    // Delete the session. Ensure it belongs to the authenticated user.
    const result = await Session.findOneAndDelete({ _id: id, userId: decoded.userId });
    
    if (!result) {
      return NextResponse.json({ error: 'Session not found or already revoked' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Session revoked successfully' }, { status: 200 });

  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
