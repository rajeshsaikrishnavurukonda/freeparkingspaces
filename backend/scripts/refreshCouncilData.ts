import '../src/services/councilAdapters'; // registers all adapters as a side effect
import { warmCouncilCaches } from '../src/services/councilAdapters/warmup';

warmCouncilCaches().then(() => process.exit(0));
