import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUserByClerkId } from '@/lib/db/users';
import { getUserBooths } from '@/lib/db/booths';
import { BoothStatus } from '@/components/booth/BoothStatus';
import { QueueVisualization } from '@/components/booth/QueueVisualization';
import { Button } from '@/components/ui/button';

export default async function DashboardPage() {
  const { userId } = auth();
  if (!userId) redirect('/sign-in');

  const user = await getUserByClerkId(userId);
  if (!user) redirect('/sign-in');

  const booths = await getUserBooths(user.id);
  const hasDedicatedBooth = booths.some((b) => b.boothType === 'dedicated');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Your PhoneBooth</h1>
          <p className="text-slate-500 mt-1">
            {user.tier === 'free'
              ? 'Using shared booth — upgrade for dedicated access'
              : 'Dedicated booth active'}
          </p>
        </div>
        {!hasDedicatedBooth && (
          <Link href="/upgrade">
            <Button>Upgrade to Pro</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {booths.map((booth) => (
          <div key={booth.id} className="space-y-4">
            <BoothStatus boothId={booth.id} boothType={booth.boothType as 'free' | 'dedicated'} />
            {booth.boothType === 'free' && (
              <QueueVisualization boothId={booth.id} />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/history">
          <Button variant="outline">View Call History</Button>
        </Link>
        <Link href="/dashboard/settings">
          <Button variant="outline">Settings</Button>
        </Link>
      </div>
    </div>
  );
}
