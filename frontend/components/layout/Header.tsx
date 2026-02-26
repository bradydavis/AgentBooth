import { UserButton } from '@clerk/nextjs';

export function Header() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-end px-6">
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
