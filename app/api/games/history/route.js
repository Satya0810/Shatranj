import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import Game from '../../../models/Game';
import User from '../../../models/User';
import { verifyToken, getTokenFromRequest } from '../../../lib/auth';
import { fetchChesscomGames } from '../../../lib/chesscomDatabase';
import { fetchLichessGames } from '../../../lib/lichessDatabase';

export async function GET(req) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    await connectDB();
    
    // Fetch user to get linked accounts
    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform') || 'all';
    const opponent = searchParams.get('opponent');
    
    // Base query: local games where the user is one of the players, or they are the owner (imported games)
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
      const matchedUsers = await User.find({ username: { $regex: opponent, $options: 'i' } }, '_id');
      const matchedUserIds = matchedUsers.map(u => u._id);

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

    // SYNC EXTERNAL GAMES FIRST
    // Fetch from Chess.com
    if ((platform === 'all' || platform === 'chess.com') && user.chesscomUsername) {
      try {
        const ccGames = await fetchChesscomGames(user.chesscomUsername, 10);
        for (const g of ccGames) {
          const platformId = `chesscom_${g.url}`;
          const isWhite = g.white.username.toLowerCase() === user.chesscomUsername.toLowerCase();
          
          let result = '1/2-1/2';
          const rCode = isWhite ? g.white.result : g.black.result;
          if (rCode === 'win') result = isWhite ? '1-0' : '0-1';
          else if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(rCode)) result = '1/2-1/2';
          else result = isWhite ? '0-1' : '1-0';

          await Game.updateOne(
            { platformGameId: platformId, owner: decoded.userId },
            {
              $setOnInsert: {
                platform: 'chess.com',
                owner: decoded.userId,
                externalWhite: g.white.username,
                externalBlack: g.black.username,
                result: result,
                startedAt: new Date(g.end_time * 1000),
                endedAt: new Date(g.end_time * 1000),
                pgn: g.pgn,
              }
            },
            { upsert: true }
          );
        }
      } catch (err) { console.error("Failed fetching chess.com games", err); }
    }

    // Fetch from Lichess
    if ((platform === 'all' || platform === 'lichess') && user.lichessUsername) {
      try {
        const lcGames = await fetchLichessGames(user.lichessUsername, 10);
        for (const g of lcGames) {
          const platformId = `lichess_${g.id}`;
          
          let result = '1/2-1/2';
          if (!g.winner) result = '1/2-1/2';
          else if (g.winner === 'white') result = '1-0';
          else result = '0-1';

          await Game.updateOne(
            { platformGameId: platformId, owner: decoded.userId },
            {
              $setOnInsert: {
                platform: 'lichess',
                owner: decoded.userId,
                externalWhite: g.players.white.user?.name || 'Anonymous',
                externalBlack: g.players.black.user?.name || 'Anonymous',
                result: result,
                startedAt: new Date(g.createdAt),
                endedAt: new Date(g.lastMoveAt || g.createdAt),
                pgn: g.pgn || '',
              }
            },
            { upsert: true }
          );
        }
      } catch (err) { console.error("Failed fetching lichess games", err); }
    }

    // NOW QUERY THE DATABASE FOR ALL GAMES
    let games = await Game.find(query)
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
