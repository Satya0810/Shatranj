import mongoose from 'mongoose';

const PuzzleRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  puzzleId: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
  timeTaken: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

export default mongoose.models.PuzzleRecord || mongoose.model('PuzzleRecord', PuzzleRecordSchema);
