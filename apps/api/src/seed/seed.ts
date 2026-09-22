import { connectDatabase, disconnectDatabase } from '../db/connect.js';
import { seedRegistry } from './registry.js';

async function seed(): Promise<void> {
  const requested = process.argv.slice(2).filter(Boolean);
  const entries = Object.entries(seedRegistry).filter(
    ([name]) => requested.length === 0 || requested.includes(name),
  );

  if (entries.length === 0) {
    console.error(
      `[seed] no matching seeders for: ${requested.join(', ')} ` +
        `(available: ${Object.keys(seedRegistry).join(', ')})`,
    );
    process.exitCode = 1;
    return;
  }

  await connectDatabase();
  try {
    for (const [name, run] of entries) {
      const summary = await run();
      console.log(`[seed:${name}] ${summary ?? 'done'}`);
    }
  } finally {
    await disconnectDatabase();
  }
}

seed().catch((error: unknown) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
