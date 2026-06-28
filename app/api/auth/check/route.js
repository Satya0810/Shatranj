import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';

export async function POST(req) {
  try {
    await connectDB();
    const { field, value } = await req.json();

    if (!field || !value) {
      return NextResponse.json({ error: 'Field and value are required' }, { status: 400 });
    }

    if (field === 'username') {
      const existing = await User.findOne({ username: { $regex: new RegExp('^' + value + '$', 'i') } });
      return NextResponse.json({ available: !existing });
    }

    if (field === 'email') {
      const existing = await User.findOne({ email: { $regex: new RegExp('^' + value + '$', 'i') } });
      return NextResponse.json({ available: !existing });
    }

    return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
  } catch (error) {
    console.error('Availability check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
