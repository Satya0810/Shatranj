import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
});

// Index for faster queries of chat histories between two users
MessageSchema.index({ senderId: 1, receiverId: 1 });
MessageSchema.index({ receiverId: 1, senderId: 1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
