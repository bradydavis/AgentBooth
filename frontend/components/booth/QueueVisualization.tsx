'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QueueItem {
  callId: string;
  agentId: string;
  phoneNumber: string;
  estimatedWait: number;
  requestedAt: number;
}

export function QueueVisualization({ boothId }: { boothId: string }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    if (!wsUrl) return;

    const ws = new WebSocket(`${wsUrl}/dashboard`);

    ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', boothId }));
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'queue_update' && data.boothId === boothId) {
        setQueue(data.queue ?? []);
      }
    };

    return () => ws.close();
  }, [boothId]);

  if (queue.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-slate-400 text-center py-4">Queue is empty</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-4">Queue — {queue.length} waiting</h3>
        <div className="space-y-2">
          {queue.map((item, index) => (
            <div key={item.callId} className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
              <div className="flex items-center gap-3">
                <Badge variant="outline">{index + 1}</Badge>
                <div>
                  <p className="text-sm font-medium">{item.agentId}</p>
                  <p className="text-xs text-slate-400">
                    Est. wait: {Math.ceil(item.estimatedWait / 60)} min
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400">{item.phoneNumber}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
