import type { Project } from '../types.js';

interface CacheEntry {
  data: Project[];
  timestamp: number;
}

class JobCache {
  private cache: CacheEntry | null = null;
  private ttl: number;
  private maxProjects: number = 100;

  constructor(ttlMinutes: number = 15) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(): { data: Project[]; cached: boolean } | null {
    if (!this.cache) {
      return null;
    }

    const now = Date.now();
    const age = now - this.cache.timestamp;

    if (age > this.ttl) {
      this.cache = null;
      return null;
    }

    return {
      data: this.cache.data,
      cached: true,
    };
  }

  set(data: Project[]): void {
    const limitedData = data.slice(0, this.maxProjects);
    this.cache = {
      data: limitedData,
      timestamp: Date.now(),
    };
  }

  clear(): void {
    this.cache = null;
  }

  isExpired(): boolean {
    if (!this.cache) return true;
    return Date.now() - this.cache.timestamp > this.ttl;
  }

  getAge(): number {
    if (!this.cache) return -1;
    return Date.now() - this.cache.timestamp;
  }
}

export const jobCache = new JobCache(15);
