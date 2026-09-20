import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { checkRateLimit, escapeRegex } from '../../../lib/rateLimit';

export async function POST(req) {
  try {
    const rateCheck = checkRateLimit(req, { limit: 40, windowMs: 60000, keyPrefix: 'auth_check' });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSeconds) } }
      );
    }

    await connectDB();
    const body = await req.json().catch(() => ({}));
    const { field, value } = body;

    if (!field || !value || typeof field !== 'string' || typeof value !== 'string' || value.length > 100) {
      return NextResponse.json({ error: 'Valid field and value are required' }, { status: 400 });
    }

    const safeRegex = new RegExp('^' + escapeRegex(value.trim()) + '$', 'i');

    if (field === 'username') {
      const existing = await User.findOne({ username: { $regex: safeRegex } });
      return NextResponse.json({ available: !existing });
    }

    if (field === 'email') {
      const existing = await User.findOne({ email: { $regex: safeRegex } });
      return NextResponse.json({ available: !existing });
    }

    return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
  } catch (error) {
    console.error('Availability check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
