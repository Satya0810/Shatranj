import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userAgent: {
    type: String,
    default: 'Unknown Device',
  },
  ipAddress: {
    type: String,
    default: 'Unknown IP',
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Prevent model recompilation in dev
export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
