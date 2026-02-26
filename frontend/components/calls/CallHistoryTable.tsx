'use client';

import { formatDuration, formatCost } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Call } from '@/lib/db/schema';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'secondary',
  failed: 'destructive',
  in_progress: 'default',
  queued: 'outline',
};

export function CallHistoryTable({ calls }: { calls: Call[] }) {
  if (calls.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-slate-400 py-12">No calls yet. Your call history will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-slate-500 text-left">
              <th className="pb-3 pr-4 font-medium">Phone</th>
              <th className="pb-3 pr-4 font-medium">Agent</th>
              <th className="pb-3 pr-4 font-medium">Duration</th>
              <th className="pb-3 pr-4 font-medium">Cost</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {calls.map((call) => (
              <tr key={call.id} className="hover:bg-slate-50">
                <td className="py-3 pr-4 font-mono">{call.phoneNumber}</td>
                <td className="py-3 pr-4 text-slate-600">{call.agentId}</td>
                <td className="py-3 pr-4">{call.duration ? formatDuration(call.duration) : '—'}</td>
                <td className="py-3 pr-4">{formatCost(call.cost)}</td>
                <td className="py-3 pr-4">
                  <Badge variant={statusVariant[call.status] ?? 'outline'}>{call.status}</Badge>
                </td>
                <td className="py-3 text-slate-500">
                  {call.startedAt ? new Date(call.startedAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
