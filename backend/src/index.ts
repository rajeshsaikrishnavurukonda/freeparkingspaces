import { createApp } from './app';
import { env } from './config/env';
import { warmCouncilCaches } from './services/councilAdapters/warmup';

const app = createApp();

app.listen(env.port, () => {
  console.log(`ParkZen backend listening on http://localhost:${env.port}`);
  warmCouncilCaches().catch((err) => console.error('[startup] Council cache warm-up failed:', err));
});
