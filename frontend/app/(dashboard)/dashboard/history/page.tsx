import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { getUserByClerkId } from '@/lib/db/users';
import { getUserBooths } from '@/lib/db/booths';
import { getCallHistory } from '@/lib/db/calls';
import { CallHistoryTable } from '@/components/calls/CallHistoryTable';

export default async function HistoryPage() {
  const { userId } = auth();
  if (!userId) redirect('/sign-in');

  const user = await getUserByClerkId(userId);
  if (!user) redirect('/sign-in');

  const booths = await getUserBooths(user.id);
  const allCalls = await Promise.all(
    booths.map((booth) => getCallHistory(booth.id, 50, 0))
  );
  const calls = allCalls.flat().sort(
    (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Call History</h1>
      <CallHistoryTable calls={calls} />
    </div>
  );
}
