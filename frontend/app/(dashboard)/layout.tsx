import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let { userId } = auth();
  
  // Hack: Mock user for local dev without Clerk keys
  if (!userId && process.env.NODE_ENV === 'development') {
    userId = 'user_test123'; // Matches seed data
  }

  // If still no user, redirect
  if (!userId) redirect('/sign-in');

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
