import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import Game from '../../../models/Game';
import PuzzleRecord from '../../../models/PuzzleRecord';
import { fetchLichessUser, fetchLichessGames } from '../../../lib/lichessDatabase';
import { fetchChesscomUser, fetchChesscomStats, fetchChesscomGames } from '../../../lib/chesscomDatabase';

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
      lichessUsername: user.lichessUsername,
      chesscomUsername: user.chesscomUsername,
    };

    if (user.lichessUsername) {
      try {
        const lichessProfile = await fetchLichessUser(user.lichessUsername);
        const lichessRecentGames = await fetchLichessGames(user.lichessUsername, 5);
        publicProfile.lichessProfile = lichessProfile;
        publicProfile.lichessRecentGames = lichessRecentGames;
      } catch (err) {
        console.error('Failed to fetch Lichess data for profile:', err);
      }
    }

    if (user.chesscomUsername) {
      try {
        const chesscomProfile = await fetchChesscomUser(user.chesscomUsername);
        const chesscomStats = await fetchChesscomStats(user.chesscomUsername);
        const chesscomRecentGames = await fetchChesscomGames(user.chesscomUsername, 5);
        publicProfile.chesscomProfile = chesscomProfile;
        publicProfile.chesscomStats = chesscomStats;
        publicProfile.chesscomRecentGames = chesscomRecentGames;
      } catch (err) {
        console.error('Failed to fetch Chess.com data for profile:', err);
      }
    }

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
