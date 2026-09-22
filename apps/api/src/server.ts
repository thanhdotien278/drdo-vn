import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './db/connect.js';

async function main(): Promise<void> {
  await connectDatabase();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });
}

main().catch((error: unknown) => {
  console.error('[api] failed to start', error);
  process.exit(1);
});
