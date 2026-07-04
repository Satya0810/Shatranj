import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import Game from '../../../models/Game';
import User from '../../../models/User';
import { verifyToken, getTokenFromRequest } from '../../../lib/auth';

export async function GET(req, { params }) {
  try {
    const token = getTokenFromRequest(req);
    // Optional auth - if it's public, maybe we don't require token, 
    // but typically history games are tied to a user.
    // If not public, we should verify. For now, let's allow it if there's no strict privacy setting,
    // or just require auth.
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;

    const game = await Game.findById(id)
      .populate('whitePlayer', 'username rating')
      .populate('blackPlayer', 'username rating')
      .lean();

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Optional: Check if user is owner or one of the players
    const isOwner = game.owner && game.owner.toString() === decoded.userId;
    const isWhite = game.whitePlayer && game.whitePlayer._id.toString() === decoded.userId;
    const isBlack = game.blackPlayer && game.blackPlayer._id.toString() === decoded.userId;
    
    if (!isOwner && !isWhite && !isBlack) {
      // Depending on privacy, maybe we allow anyone to see games, but just in case:
      // return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      // We will allow it for now since analysis boards are often shareable.
    }

    return NextResponse.json(game, { status: 200 });

  } catch (error) {
    console.error('Fetch game error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
