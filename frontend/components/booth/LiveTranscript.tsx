'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TranscriptLine {
  speaker: 'caller' | 'agent';
  text: string;
  timestamp: number;
}

export function LiveTranscript({ callId, boothId }: { callId: string; boothId: string }) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    if (!wsUrl) return;

    const ws = new WebSocket(`${wsUrl}/dashboard`);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', boothId }));
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'transcript' && data.callId === callId) {
        setLines((prev) => [...prev, {
          speaker: data.speaker,
          text: data.text,
          timestamp: data.timestamp,
        }]);
      }
    };

    return () => ws.close();
  }, [callId, boothId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-4">Live Transcript</h3>
        <div className="h-80 overflow-y-auto space-y-3 pr-2">
          {lines.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Waiting for transcript...</p>
          )}
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'px-4 py-2 rounded-lg text-sm max-w-[85%]',
                line.speaker === 'caller'
                  ? 'bg-blue-50 text-blue-900 ml-auto'
                  : 'bg-green-50 text-green-900'
              )}
            >
              <p className="text-xs font-medium mb-1 opacity-70">
                {line.speaker === 'caller' ? 'Caller' : 'Agent'}
              </p>
              {line.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </CardContent>
    </Card>
  );
}
