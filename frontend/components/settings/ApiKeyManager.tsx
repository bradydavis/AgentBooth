'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string | null;
  lastUsedAt: Date | null;
  createdAt: Date | null;
}

export function ApiKeyManager({ userId, apiKeys }: { userId: string; apiKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(apiKeys);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const createKey = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Key ${keys.length + 1}` }),
      });
      const data = await res.json();
      if (data.key) setNewKeyValue(data.key);
      if (data.created) setKeys((prev) => [...prev, data.created]);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">API Keys</h2>
          <Button onClick={createKey} disabled={creating} size="sm">
            {creating ? 'Creating...' : 'Create Key'}
          </Button>
        </div>

        {newKeyValue && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 text-sm">
            <p className="font-medium text-green-800 mb-1">Copy this key — it won&apos;t be shown again:</p>
            <code className="text-green-900 break-all">{newKeyValue}</code>
          </div>
        )}

        {keys.length === 0 ? (
          <p className="text-sm text-slate-400">No API keys yet. Create one to use with your MCP server.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
                <div>
                  <p className="font-mono text-sm">{key.keyPrefix}...</p>
                  {key.name && <p className="text-xs text-slate-400">{key.name}</p>}
                </div>
                <Badge variant="outline">
                  {key.lastUsedAt
                    ? `Used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                    : 'Never used'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
