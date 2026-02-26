import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { getUserByClerkId } from '@/lib/db/users';
import { getUserApiKeys } from '@/lib/db/api-keys';
import { ApiKeyManager } from '@/components/settings/ApiKeyManager';

export default async function SettingsPage() {
  const { userId } = auth();
  if (!userId) redirect('/sign-in');

  const user = await getUserByClerkId(userId);
  if (!user) redirect('/sign-in');

  const apiKeys = await getUserApiKeys(user.id);

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
      <ApiKeyManager userId={user.id} apiKeys={apiKeys} />
    </div>
  );
}
