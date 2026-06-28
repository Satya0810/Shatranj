import mongoose from 'mongoose';

const GameSchema = new mongoose.Schema({
  whitePlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  blackPlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  pgn: {
    type: String,
    default: '',
  },
  result: {
    type: String,
    enum: ['1-0', '0-1', '1/2-1/2', '*'],
    default: '*',
  },
  resultReason: {
    type: String,
    enum: ['checkmate', 'resignation', 'timeout', 'stalemate', 'draw', 'agreement', 'disconnect'],
    default: 'checkmate',
  },
  timeControl: {
    minutes: { type: Number, default: 10 },
    increment: { type: Number, default: 0 },
  },
  moves: [{
    san: String,
    from: String,
    to: String,
    fen: String,
    timestamp: Date,
  }],
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

export default mongoose.models.Game || mongoose.model('Game', GameSchema);
