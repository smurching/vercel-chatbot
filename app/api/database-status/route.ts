import { NextResponse } from 'next/server';
import { isDatabaseAvailable } from '@/lib/db/connection';

export async function GET() {
  try {
    const available = isDatabaseAvailable();

    return NextResponse.json({
      available,
      message: available
        ? 'Database storage is available'
        : 'Using in-memory storage - chats will not persist'
    });
  } catch (error) {
    console.error('Error checking database status:', error);
    return NextResponse.json({
      available: false,
      message: 'Could not determine database status, using in-memory storage'
    }, { status: 500 });
  }
}