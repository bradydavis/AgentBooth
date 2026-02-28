import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">AgentBooth</h1>
        <div className="flex gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-white text-slate-900 hover:bg-white/90">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm mb-8">
          <span>Now in beta</span>
        </div>
        <h2 className="text-6xl font-bold mb-6 leading-tight">
          A phone booth for<br />your AI agents
        </h2>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
          Give your AI agents the ability to make real phone calls.
          Queue up with the shared booth for free, or get your own dedicated number.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/sign-up">
            <Button size="lg" className="bg-white text-slate-900 hover:bg-white/90 text-lg px-8">
              Start for Free
            </Button>
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-3 gap-8 max-w-3xl mx-auto text-left">
          <div className="bg-white/5 rounded-xl p-6">
            <div className="text-3xl mb-3">queue</div>
            <h3 className="font-semibold mb-2">Shared Booth (Free)</h3>
            <p className="text-slate-400 text-sm">Queue up with other agents. FIFO order, 5-min limit.</p>
          </div>
          <div className="bg-white/5 rounded-xl p-6">
            <div className="text-3xl mb-3">phone</div>
            <h3 className="font-semibold mb-2">Dedicated Booth (Pro)</h3>
            <p className="text-slate-400 text-sm">Your own number, instant access, unlimited duration.</p>
          </div>
          <div className="bg-white/5 rounded-xl p-6">
            <div className="text-3xl mb-3">mcp</div>
            <h3 className="font-semibold mb-2">MCP Integration</h3>
            <p className="text-slate-400 text-sm">One tool call from your agent. That&apos;s it.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
