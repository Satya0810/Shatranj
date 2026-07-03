import { NextResponse } from 'next/server';
import connectDB from '../../../../lib/mongodb';
import Game from '../../../../models/Game';
import { verifyToken, getTokenFromRequest } from '../../../../lib/auth';

export async function POST(req, { params }) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    const { analysisReport } = await req.json();

    if (!analysisReport) {
      return NextResponse.json({ error: 'Analysis report is required' }, { status: 400 });
    }

    await connectDB();

    const game = await Game.findById(id);
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Only allow participants or owner to save analysis
    const isParticipant = (game.whitePlayer && game.whitePlayer.toString() === decoded.userId) || 
                          (game.blackPlayer && game.blackPlayer.toString() === decoded.userId);
    const isOwner = game.owner && game.owner.toString() === decoded.userId;

    if (!isParticipant && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    game.analysisReport = analysisReport;
    await game.save();

    return NextResponse.json({ message: 'Analysis saved successfully' }, { status: 200 });

  } catch (error) {
    console.error('Save analysis error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
