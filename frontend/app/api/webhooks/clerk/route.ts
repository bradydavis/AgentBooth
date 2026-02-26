import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createUser } from '@/lib/db/users';

export async function POST(request: Request) {
  const body = await request.text();
  const headers = {
    'svix-id': request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  };

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  let event: { type: string; data: { id: string; email_addresses: Array<{ email_address: string }> } };

  try {
    event = wh.verify(body, headers) as typeof event;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'user.created') {
    const { id, email_addresses } = event.data;
    const email = email_addresses[0]?.email_address ?? '';
    await createUser(id, email);
  }

  return NextResponse.json({ received: true });
}
