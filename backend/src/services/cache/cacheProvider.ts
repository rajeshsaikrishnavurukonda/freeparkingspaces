export interface CacheProvider {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlSeconds: number): void;
  has(key: string): boolean;
  del(key: string): void;
}
