import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { getUserByClerkId } from '@/lib/db/users';

// This just re-exports from the right modules
export { GET, POST };

async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUserByClerkId(userId);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { getUserApiKeys: getKeys } = await import('@/lib/db/api-keys');
  const keys = await getKeys(user.id);
  return NextResponse.json({ keys });
}

async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUserByClerkId(userId);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { name } = await request.json();
  const { createApiKey: create } = await import('@/lib/db/api-keys');
  const created = await create(user.id, name ?? 'My Key');
  return NextResponse.json({ key: created.key, created });
}
