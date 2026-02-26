import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { getCallHistory } from '@/lib/db/calls';

export async function GET(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const boothId = searchParams.get('boothId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  if (!boothId) {
    return NextResponse.json({ error: 'boothId required' }, { status: 400 });
  }

  const calls = await getCallHistory(boothId, limit, offset);
  return NextResponse.json({ calls });
}
