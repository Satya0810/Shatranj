import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import PuzzleRecord from '../../../models/PuzzleRecord';
import { getTokenFromRequest, verifyToken } from '../../../lib/auth';

export async function POST(req) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { puzzleId, rating, isCorrect, timeTaken } = body;

    if (!puzzleId || typeof isCorrect !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Save the puzzle record
    await PuzzleRecord.create({
      userId: user._id,
      puzzleId,
      rating: rating || 1500,
      isCorrect,
      timeTaken: timeTaken || 0,
    });

    // Optionally update user's puzzle ELO rating here later

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Puzzle record error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
