import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { getUserByClerkId } from '@/lib/db/users';
import { getUserBooths } from '@/lib/db/booths';
import { redis } from '@/lib/redis';

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserByClerkId(userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const booths = await getUserBooths(user.id);

  const enrichedBooths = await Promise.all(
    booths.map(async (booth) => {
      const [state, queueLength] = await Promise.all([
        redis.hgetall(`booth:${booth.id}:state`),
        redis.llen(`booth:${booth.id}:queue`),
      ]);

      return {
        ...booth,
        status: (state as Record<string, string>)?.status ?? 'idle',
        currentCallId: (state as Record<string, string>)?.currentCallId ?? null,
        queueLength: queueLength ?? 0,
      };
    })
  );

  return NextResponse.json({ booths: enrichedBooths });
}
