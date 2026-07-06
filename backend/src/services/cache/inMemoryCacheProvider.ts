import NodeCache from 'node-cache';
import { CacheProvider } from './cacheProvider';

export class InMemoryCacheProvider implements CacheProvider {
  private store: NodeCache;

  constructor() {
    this.store = new NodeCache({ useClones: false });
  }

  get<T>(key: string): T | undefined {
    return this.store.get<T>(key);
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, value, ttlSeconds);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  del(key: string): void {
    this.store.del(key);
  }
}

export const cache = new InMemoryCacheProvider();
