'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';

interface BoothStatusProps {
  boothId: string;
  boothType: 'free' | 'dedicated';
}

interface CurrentCall {
  phoneNumber: string;
  agentId: string;
  durationSeconds: number;
}

type BoothState = 'idle' | 'occupied' | 'ringing';

export function BoothStatus({ boothId, boothType }: BoothStatusProps) {
  const [status, setStatus] = useState<BoothState>('idle');
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    if (!wsUrl) return;

    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      ws = new WebSocket(`${wsUrl}/dashboard`);

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', boothId }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.boothId !== boothId) return;

        if (data.type === 'booth_status') {
          setStatus(data.status);
          setCurrentCall(data.currentCall ?? null);
        }
        if (data.type === 'queue_update') {
          setQueueLength(data.queueLength ?? 0);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      ws?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [boothId]);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {boothType === 'free' ? 'Shared Booth' : 'Your Booth'}
            </h2>
            {!connected && (
              <p className="text-xs text-slate-400 mt-0.5">Connecting...</p>
            )}
          </div>
          <Badge variant={status === 'idle' ? 'secondary' : 'default'}>
            {status === 'idle' ? 'Idle' : status === 'ringing' ? 'Ringing' : 'In Call'}
          </Badge>
        </div>

        {status === 'occupied' && currentCall && (
          <div className="space-y-1 text-sm text-slate-600 bg-slate-50 rounded-md p-3">
            <p><span className="font-medium">Calling:</span> {currentCall.phoneNumber}</p>
            <p><span className="font-medium">Agent:</span> {currentCall.agentId}</p>
            <p><span className="font-medium">Duration:</span> {formatDuration(currentCall.durationSeconds)}</p>
          </div>
        )}

        {boothType === 'free' && (
          <div className="mt-4 pt-4 border-t text-sm text-slate-500">
            {queueLength === 0
              ? 'No agents waiting'
              : `${queueLength} agent${queueLength > 1 ? 's' : ''} in queue`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
