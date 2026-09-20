import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import connectDB from './mongodb';
import Session from '../models/Session';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is not defined in production!');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev_fallback_secret_chessmaster_key_do_not_use_in_prod';

export function signToken(userId, sessionId) {
  return jwt.sign({ userId, jti: sessionId }, EFFECTIVE_JWT_SECRET, { expiresIn: '30d' });
}

export async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    if (!decoded || !decoded.jti) return null;
    
    await connectDB();
    const session = await Session.findById(decoded.jti);
    if (!session) return null; // Session was revoked
    
    // Optionally update lastActive timestamp here (throttled to avoid DB hammering)
    // if (Date.now() - new Date(session.lastActive).getTime() > 3600000) {
    //   session.lastActive = new Date();
    //   await session.save();
    // }
    
    return decoded;
  } catch (e) {
    return null;
  }
}

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function getTokenFromRequest(req) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}
