import { getAllAdapters } from './registry';

/**
 * Pre-fetches and normalizes every registered council adapter's data so the
 * normalized-spot cache is warm before live requests arrive. With the current
 * in-memory (single-process) cache this only warms the process that runs it —
 * meaningful once a shared cache (Redis) is introduced, and useful right now
 * as a smoke test that each adapter's fetch+normalize pipeline still works.
 */
export async function warmCouncilCaches(): Promise<void> {
  for (const adapter of getAllAdapters()) {
    try {
      console.log(`[refresh] Fetching + normalizing ${adapter.displayName}...`);
      const raw = await adapter.fetchRaw();
      const spots = await adapter.normalize(raw);
      console.log(`[refresh] ${adapter.displayName}: ${spots.length} free-parking spots normalized.`);
    } catch (err) {
      console.error(`[refresh] Failed to refresh ${adapter.displayName}:`, err);
    }
  }
}
