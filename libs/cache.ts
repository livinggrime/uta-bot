interface CacheEntry<T> {
    data: T;
    expires?: number;
    accessTime: number;
}

class MemoryCache<T = any> {
    private cache = new Map<string, CacheEntry<T>>();
    private readonly defaultTTL: number;
    private readonly maxSize: number;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(defaultTTL: number = 300000, maxSize: number = 10000) {
        this.defaultTTL = defaultTTL;
        this.maxSize = maxSize;
        this.startCleanup();
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        if (entry.expires && Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
        }
        
        entry.accessTime = Date.now();
        return entry.data;
    }

    set(key: string, data: T, ttl?: number): void {
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        const expires = ttl ? Date.now() + ttl : 
                        this.defaultTTL ? Date.now() + this.defaultTTL : undefined;
        
        this.cache.set(key, { 
            data, 
            expires, 
            accessTime: Date.now() 
        });
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }

    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.accessTime < oldestTime) {
                oldestTime = entry.accessTime;
                oldestKey = key;
            }
        }
        
        if (oldestKey !== null) {
            this.cache.delete(oldestKey);
        }
    }

    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.cache.entries()) {
                if (entry.expires && now > entry.expires) {
                    this.cache.delete(key);
                }
            }
        }, 60000);
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
    }
}

class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private readonly maxSize: number;

    constructor(maxSize: number = 1000) {
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

class RequestDeduplicator<T = any> {
    private pending = new Map<string, Promise<T>>();

    async deduplicate(key: string, fn: () => Promise<T>): Promise<T> {
        if (this.pending.has(key)) {
            return this.pending.get(key)!;
        }

        const promise = fn();
        this.pending.set(key, promise);

        promise.finally(() => {
            this.pending.delete(key);
        });

        return promise;
    }

    clear(): void {
        this.pending.clear();
    }

    size(): number {
        return this.pending.size;
    }
}

export const lastfmCache = new MemoryCache(300000, 5000);
export const chartCache = new MemoryCache(3600000, 1000);
export const commandCache = new LRUCache<string, any>(1000);
export const requestDeduplicator = new RequestDeduplicator();

export { MemoryCache, LRUCache, RequestDeduplicator };