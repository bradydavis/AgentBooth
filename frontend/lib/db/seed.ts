import { db } from './index';
import { users, booths, calls } from './schema';

async function seedDatabase() {
  console.log('Seeding database...');

  const [testUser] = await db.insert(users).values({
    clerkUserId: 'user_test123',
    email: 'test@phonebooth.app',
    tier: 'free',
  }).returning();

  const [freeBooth] = await db.insert(booths).values({
    userId: testUser.id,
    boothType: 'free',
    status: 'active',
    settings: {},
  }).returning();

  await db.insert(calls).values([
    {
      boothId: freeBooth.id,
      agentId: 'agent-test-1',
      phoneNumber: '+15555550100',
      status: 'completed',
      duration: 120,
      cost: '0.50',
      startedAt: new Date(Date.now() - 86400000),
      endedAt: new Date(Date.now() - 86400000 + 120000),
    },
    {
      boothId: freeBooth.id,
      agentId: 'agent-test-2',
      phoneNumber: '+15555550101',
      status: 'completed',
      duration: 180,
      cost: '0.75',
      startedAt: new Date(Date.now() - 43200000),
      endedAt: new Date(Date.now() - 43200000 + 180000),
    },
  ]);

  console.log('Seeded successfully. Free booth ID:', freeBooth.id);
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
