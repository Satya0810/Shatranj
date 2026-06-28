import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import Game from '../../../models/Game';
import PuzzleRecord from '../../../models/PuzzleRecord';

export async function GET(req, { params }) {
  try {
    await connectDB();

    const resolvedParams = await params;
    const { username } = resolvedParams;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only return public profile data
    const publicProfile = {
      username: user.username,
      rating: user.rating,
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };

    // Fetch recent games
    const recentGames = await Game.find({
      $or: [{ whitePlayer: user._id }, { blackPlayer: user._id }]
    })
      .sort({ endedAt: -1, createdAt: -1 })
      .limit(5)
      .populate('whitePlayer', 'username rating')
      .populate('blackPlayer', 'username rating')
      .lean();

    // Fetch recent puzzles
    const recentPuzzles = await PuzzleRecord.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    publicProfile.recentGames = recentGames;
    publicProfile.recentPuzzles = recentPuzzles;

    return NextResponse.json(publicProfile, { status: 200 });

  } catch (error) {
    console.error('Fetch user profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
