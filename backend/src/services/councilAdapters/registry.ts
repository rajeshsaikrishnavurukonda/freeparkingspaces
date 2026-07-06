import { CouncilAdapter } from './types';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const registry = new Map<string, CouncilAdapter>();
let dynamicAdapterFactory: ((councilName: string) => CouncilAdapter) | undefined;

export function registerAdapter(adapter: CouncilAdapter): void {
  registry.set(slugify(adapter.councilId), adapter);
}

/**
 * Registers a fallback factory used for any council without a specific
 * registered adapter. The factory is called with the resolved council name
 * at lookup time, so a fresh adapter instance is created per council on demand
 * rather than one adapter per council being pre-registered.
 */
export function registerDynamicAdapter(factory: (councilName: string) => CouncilAdapter): void {
  dynamicAdapterFactory = factory;
}

export function getAdapterForCouncil(adminDistrict: string | null | undefined): CouncilAdapter | undefined {
  if (!adminDistrict) return undefined;
  const specific = registry.get(slugify(adminDistrict));
  if (specific) return specific;
  return dynamicAdapterFactory ? dynamicAdapterFactory(adminDistrict) : undefined;
}

export function getAllAdapters(): CouncilAdapter[] {
  return Array.from(registry.values());
}
