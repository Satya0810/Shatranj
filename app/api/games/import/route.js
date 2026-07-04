import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import Game from '../../../models/Game';
import { verifyToken, getTokenFromRequest } from '../../../lib/auth';
import { Chess } from 'chess.js';

export async function POST(req) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { pgn, platform } = await req.json();

    if (!pgn || !platform) {
      return NextResponse.json({ error: 'PGN and platform are required' }, { status: 400 });
    }

    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid PGN format' }, { status: 400 });
    }

    const header = chess.header();
    
    await connectDB();

    const newGame = await Game.create({
      pgn: pgn,
      platform: platform,
      owner: decoded.userId,
      externalWhite: header.White || 'Unknown',
      externalBlack: header.Black || 'Unknown',
      result: header.Result || '*',
      startedAt: header.Date && header.Date !== '??' ? new Date(header.Date.replace(/\./g, '-')) : new Date(),
      endedAt: header.Date && header.Date !== '??' ? new Date(header.Date.replace(/\./g, '-')) : new Date(),
    });

    return NextResponse.json({ message: 'Game imported successfully', gameId: newGame._id }, { status: 201 });

  } catch (error) {
    console.error('Import game error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
