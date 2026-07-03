import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import Game from '../../../models/Game';
import User from '../../../models/User';
import { verifyToken, getTokenFromRequest } from '../../../lib/auth';

export async function GET(req) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const opponent = searchParams.get('opponent');
    
    // Base query: games where the user is one of the players, or they are the owner (imported games)
    const query = {
      $or: [
        { whitePlayer: decoded.userId },
        { blackPlayer: decoded.userId },
        { owner: decoded.userId }
      ]
    };

    if (platform && platform !== 'all') {
      query.platform = platform;
    }

    // Optional opponent filter
    if (opponent) {
      // Find matching user IDs first
      const matchedUsers = await User.find({ username: { $regex: opponent, $options: 'i' } }, '_id');
      const matchedUserIds = matchedUsers.map(u => u._id);

      // Require the game to either have the opponent in local DB, or match external name
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { whitePlayer: { $in: matchedUserIds }, _id: { $exists: true } },
          { blackPlayer: { $in: matchedUserIds }, _id: { $exists: true } },
          { externalWhite: { $regex: opponent, $options: 'i' } },
          { externalBlack: { $regex: opponent, $options: 'i' } }
        ]
      });
    }

    const games = await Game.find(query)
      .sort({ endedAt: -1, startedAt: -1 })
      .populate('whitePlayer', 'username rating')
      .populate('blackPlayer', 'username rating')
      .lean();

    return NextResponse.json({ games }, { status: 200 });

  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
