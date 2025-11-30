import type {
    CacheEntry,
    CacheEventCallback,
    CacheEventType,
    CacheStats,
    LRUCacheOptions,
    SerializedCache,
} from '../types';
import {loadDiscordCollection} from '../utils';
import {LRUList} from '../node/lru-node';

/**
 * The Least Recently Used (LRU) cache implementation with optional TTL support.
 *
 * The cache automatically evicts the least recently used entries when the maximum
 * size is reached. Entries can also expire based on a configurable TTL.
 *
 * @template K - The type of keys in the cache
 * @template V - The type of values in the cache
 * 
 * @DE
 * Die Least Recently Used (LRU) Cache-Implementierung mit optionaler TTL-Unterstützung.
 *
 * Der Cache entfernt automatisch die am längsten nicht verwendeten Einträge, wenn die maximale
 * Größe erreicht wird. Einträge können auch basierend auf einer konfigurierbaren TTL ablaufen.
 *
 * @template K - Der Typ der Schlüssel im Cache
 * @template V - Der Typ der Werte im Cache
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, number>({
 *   maxSize: 100,
 *   ttl: 60000, // 1 minute
 *   enableStats: true
 * });
 *
 * cache.set('key', 123);
 * const value = cache.get('key'); // 123
 * console.log(cache.getStats());
 * ```
 */
export class LRUCache<K, V> {
    private readonly maxSize: number | undefined;
    private readonly maxMemoryBytes: number | undefined;
    private readonly ttl: number | null;
    private readonly slidingTTL: boolean;
    private readonly maxTTL: number | null;
    private readonly cache: Map<K, CacheEntry<V>>;
    private readonly keyOrder: LRUList<K>;
    private readonly enableStats: boolean;
    private currentMemoryUsage = 0;

    // Background cleanup
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly autoCleanup: boolean;
    private readonly cleanupIntervalMs: number;

    // Statistics
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        expirations: 0,
    };

    // Event listeners
    private eventListeners: Map<CacheEventType, Array<(...args: any[]) => void>> =
        new Map();

    /**
     * Creates a new LRU cache instance.
     *
     * @param options - Configuration options for the cache
     * @throws {Error} If useCollection is true but discord.js is not installed
     * @throws {Error} If neither maxSize nor maxMemoryBytes is specified
     * 
     * @DE
     * Erstellt eine neue LRU-Cache-Instanz.
     *
     * @param options - Konfigurationsoptionen für den Cache
     * @throws {Error} Wenn useCollection true ist, aber discord.js nicht installiert ist
     * @throws {Error} Wenn weder maxSize noch maxMemoryBytes angegeben ist
     */
    constructor(options: LRUCacheOptions) {
        if (!options.maxSize && !options.maxMemoryBytes) {
            throw new Error('Either maxSize or maxMemoryBytes must be specified');
        }

        this.maxSize = options.maxSize;
        this.maxMemoryBytes = options.maxMemoryBytes;
        this.ttl = options.ttl ?? null;
        this.slidingTTL = options.slidingTTL ?? false;
        this.maxTTL = options.maxTTL ?? null;
        this.autoCleanup = options.autoCleanup ?? false;
        this.cleanupIntervalMs = options.cleanupInterval ?? 60000;
        this.enableStats = options.enableStats ?? false;
        this.keyOrder = new LRUList<K>();

        if (options.useCollection) {
            const Collection = loadDiscordCollection();
            this.cache = new Collection() as Map<K, CacheEntry<V>>;
        } else {
            this.cache = new Map<K, CacheEntry<V>>();
        }

        if (this.autoCleanup && this.ttl !== null) {
            this.startCleanupTimer();
        }
    }

    /**
     * Gets the current number of entries in the cache, excluding expired entries.
     *
     * This property automatically prunes expired entries before returning the count.
     *
     * @returns The number of valid entries in the cache
     * 
     * @DE
     * Gibt die aktuelle Anzahl der Einträge im Cache zurück, ohne abgelaufene Einträge.
     *
     * Diese Eigenschaft räumt automatisch abgelaufene Einträge auf, bevor die Anzahl zurückgegeben wird.
     *
     * @returns Die Anzahl der gültigen Einträge im Cache
     *
     * @example
     * ```typescript
     * console.log(`Cache contains ${cache.size} entries`);
     * ```
     */
    get size(): number {
        this.pruneExpired();
        return this.cache.size;
    }

    /**
     * Create cache from serialized JSON data.
     *
     * @param json - Serialized cache data
     * @returns New cache instance
     * 
     * @DE
     * Erstelle Cache aus serialisierten JSON-Daten.
     *
     * @param json - Serialisierte Cache-Daten
     * @returns Neue Cache-Instanz
     *
     * @example
     * ```typescript
     * const cache = LRUCache.fromJSON(json);
     * ```
     */
    static fromJSON<K, V>(json: SerializedCache<K, V>): LRUCache<K, V> {
        const cache = new LRUCache<K, V>({
            maxSize: json.maxSize,
            maxMemoryBytes: json.maxMemoryBytes,
            ttl: json.ttl ?? undefined,
            slidingTTL: json.slidingTTL,
            maxTTL: json.maxTTL ?? undefined,
        });

        for (const {key, value, expiry, createdAt, size} of json.entries) {
            // Only restore non-expired entries
            if (expiry > Date.now()) {
                cache.cache.set(key, {value, expiry, createdAt, size});
                cache.keyOrder.push(key);
                if (size) {
                    cache.currentMemoryUsage += size;
                }
            }
        }

        return cache;
    }

    /**
     * Adds or updates an entry in the cache with default TTL.
     *
     * If the key already exists, its value is updated, and it's marked as most recently used.
     * If the cache is at maximum capacity, the least recently used entry is evicted.
     *
     * @param key - The key to set
     * @param value - The value to cache
     * 
     * @DE
     * Fügt einen Eintrag im Cache hinzu oder aktualisiert ihn mit Standard-TTL.
     *
     * Wenn der Schlüssel bereits existiert, wird sein Wert aktualisiert und er wird als zuletzt verwendet markiert.
     * Wenn der Cache die maximale Kapazität erreicht hat, wird der am längsten nicht verwendete Eintrag entfernt.
     *
     * @param key - Der zu setzende Schlüssel
     * @param value - Der zu cachende Wert
     *
     * @example
     * ```typescript
     * cache.set('user:123', { name: 'Alice' });
     * ```
     */
    set(key: K, value: V): void {
        this.setWithTTL(key, value, this.ttl ?? undefined);
    }

    /**
     * Adds or updates an entry in the cache with a custom TTL.
     *
     * @param key - The key to set
     * @param value - The value to cache
     * @param customTTL - Custom TTL in milliseconds (undefined for no expiry)
     * 
     * @DE
     * Fügt einen Eintrag im Cache hinzu oder aktualisiert ihn mit benutzerdefinierter TTL.
     *
     * @param key - Der zu setzende Schlüssel
     * @param value - Der zu cachende Wert
     * @param customTTL - Benutzerdefinierte TTL in Millisekunden (undefined für kein Ablaufen)
     *
     * @example
     * ```typescript
     * cache.setWithTTL('temp:data', data, 5000); // 5 seconds
     * ```
     */
    setWithTTL(key: K, value: V, customTTL?: number): void {
        const isUpdate = this.cache.has(key);
        const expiry = customTTL ? Date.now() + customTTL : Infinity;
        const createdAt = Date.now();
        const size = this.maxMemoryBytes ? this.estimateSize(value) : undefined;

        // Remove old entry if updating
        if (isUpdate) {
            const oldEntry = this.cache.get(key);
            if (oldEntry && oldEntry.size) {
                this.currentMemoryUsage -= oldEntry.size;
            }
        }

        // Evict entries if necessary
        if (!isUpdate) {
            // Memory-based eviction
            if (this.maxMemoryBytes && size) {
                while (
                    this.cache.size > 0 &&
                    this.currentMemoryUsage + size > this.maxMemoryBytes
                    ) {
                    this.evictOldest('memory');
                }
            }

            // Size-based eviction
            if (this.maxSize && this.cache.size >= this.maxSize) {
                this.evictOldest('size');
            }
        }

        // Add/update entry
        this.cache.set(key, {value, expiry, createdAt, size});
        this.keyOrder.push(key);

        if (size) {
            this.currentMemoryUsage += size;
        }

        this.emit('set', key, value, isUpdate);
    }

    /**
     * Retrieves a value from the cache.
     *
     * Accessing a key marks it as most recently used. If the entry has expired,
     * it's automatically removed and undefined is returned.
     *
     * @param key - The key to retrieve
     * @returns The cached value, or undefined if not found or expired
     * 
     * @DE
     * Holt einen Wert aus dem Cache.
     *
     * Beim Zugriff auf einen Schlüssel wird er als zuletzt verwendet markiert. Wenn der Eintrag abgelaufen ist,
     * wird er automatisch entfernt und undefined zurückgegeben.
     *
     * @param key - Der abzurufende Schlüssel
     * @returns Der gecachte Wert, oder undefined wenn nicht gefunden oder abgelaufen
     *
     * @example
     * ```typescript
     * const value = cache.get('user:123');
     * if (value) {
     *   console.log('Found:', value);
     * }
     * ```
     */
    get(key: K): V | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            if (this.enableStats) this.stats.misses++;
            return undefined;
        }

        // Check absolute max TTL
        if (this.maxTTL && Date.now() - entry.createdAt > this.maxTTL) {
            this.deleteEntry(key, entry, 'expire');
            if (this.enableStats) this.stats.misses++;
            return undefined;
        }

        if (this.isExpired(entry)) {
            this.deleteEntry(key, entry, 'expire');
            if (this.enableStats) this.stats.misses++;
            return undefined;
        }

        // Sliding TTL: refresh expiry on access
        if (this.slidingTTL && this.ttl && entry.expiry !== Infinity) {
            entry.expiry = Date.now() + this.ttl;
        }

        this.keyOrder.moveToEnd(key);
        if (this.enableStats) this.stats.hits++;
        return entry.value;
    }

    /**
     * Retrieves a value without updating LRU order or TTL.
     *
     * @param key - The key to peek at
     * @returns The cached value, or undefined if not found or expired
     * 
     * @DE
     * Holt einen Wert ohne LRU-Reihenfolge oder TTL zu aktualisieren.
     *
     * @param key - Der Schlüssel zum Reinschauen
     * @returns Der gecachte Wert, oder undefined wenn nicht gefunden oder abgelaufen
     *
     * @example
     * ```typescript
     * const value = cache.peek('user:123');
     * ```
     */
    peek(key: K): V | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        if (this.maxTTL && Date.now() - entry.createdAt > this.maxTTL) {
            return undefined;
        }

        if (this.isExpired(entry)) {
            return undefined;
        }

        return entry.value;
    }

    /**
     * Checks if a key exists in the cache and hasn't expired.
     *
     * @param key - The key to check
     * @returns True if the key exists and is valid, false otherwise
     * 
     * @DE
     * Überprüft, ob ein Schlüssel im Cache existiert und nicht abgelaufen ist.
     *
     * @param key - Der zu prüfende Schlüssel
     * @returns True wenn der Schlüssel existiert und gültig ist, sonst false
     *
     * @example
     * ```typescript
     * if (cache.has('user:123')) {
     *   console.log('User is cached');
     * }
     * ```
     */
    has(key: K): boolean {
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        if (this.maxTTL && Date.now() - entry.createdAt > this.maxTTL) {
            this.deleteEntry(key, entry, 'expire');
            return false;
        }

        if (this.isExpired(entry)) {
            this.deleteEntry(key, entry, 'expire');
            return false;
        }

        return true;
    }

    /**
     * Removes an entry from the cache.
     *
     * @param key - The key to remove
     * @returns True if the entry was removed, false if it didn't exist
     * 
     * @DE
     * Entfernt einen Eintrag aus dem Cache.
     *
     * @param key - Der zu entfernende Schlüssel
     * @returns True wenn der Eintrag entfernt wurde, false wenn er nicht existierte
     *
     * @example
     * ```typescript
     * cache.delete('user:123');
     * ```
     */
    delete(key: K): boolean {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }

        return this.deleteEntry(key, entry, 'delete');
    }

    /**
     * Removes all entries from the cache.
     * 
     * @DE
     * Entfernt alle Einträge aus dem Cache.
     *
     * @example
     * ```typescript
     * cache.clear();
     * ```
     */
    clear(): void {
        this.cache.clear();
        this.keyOrder.clear();
        this.currentMemoryUsage = 0;
        this.emit('clear');
    }

    /**
     * Get remaining TTL for a key in milliseconds.
     *
     * @param key - The key to check
     * @returns Remaining TTL in milliseconds, or null if key doesn't exist or has no expiry
     * 
     * @DE
     * Hole verbleibende TTL für einen Schlüssel in Millisekunden.
     *
     * @param key - Der zu prüfende Schlüssel
     * @returns Verbleibende TTL in Millisekunden, oder null wenn Schlüssel nicht existiert oder kein Ablaufen hat
     *
     * @example
     * ```typescript
     * const ttl = cache.getTTL('user:123');
     * console.log(`Expires in ${ttl}ms`);
     * ```
     */
    getTTL(key: K): number | null {
        const entry = this.cache.get(key);
        if (!entry || entry.expiry === Infinity) {
            return null;
        }

        if (this.isExpired(entry)) {
            this.deleteEntry(key, entry, 'expire');
            return null;
        }

        return Math.max(0, entry.expiry - Date.now());
    }

    /**
     * Update TTL for an entry without changing its value.
     *
     * @param key - The key to update
     * @param ttl - New TTL in milliseconds (undefined for no expiry)
     * @returns True if the entry was updated, false if it doesn't exist
     * 
     * @DE
     * Aktualisiere TTL für einen Eintrag ohne seinen Wert zu ändern.
     *
     * @param key - Der zu aktualisierende Schlüssel
     * @param ttl - Neue TTL in Millisekunden (undefined für kein Ablaufen)
     * @returns True wenn der Eintrag aktualisiert wurde, false wenn er nicht existiert
     *
     * @example
     * ```typescript
     * cache.touch('user:123', 30000); // Extend by 30 seconds
     * ```
     */
    touch(key: K, ttl?: number): boolean {
        const entry = this.cache.get(key);
        if (!entry || this.isExpired(entry)) {
            return false;
        }

        if (ttl !== undefined) {
            entry.expiry = Date.now() + ttl;
        } else if (this.ttl) {
            entry.expiry = Date.now() + this.ttl;
        }

        this.keyOrder.moveToEnd(key);
        return true;
    }

    /**
     * Get or compute a value if not in cache.
     *
     * @param key - The key to get or compute
     * @param computeFn - Function to compute the value if not cached
     * @returns The cached or computed value
     * 
     * @DE
     * Hole oder berechne einen Wert, wenn er nicht im Cache ist.
     *
     * @param key - Der zu holende oder berechnende Schlüssel
     * @param computeFn - Funktion zum Berechnen des Werts, wenn er nicht gecacht ist
     * @returns Der gecachte oder berechnete Wert
     *
     * @example
     * ```typescript
     * const user = await cache.getOrCompute('user:123', async () => {
     *   return await fetchUser(123);
     * });
     * ```
     */
    getOrCompute(key: K, computeFn: () => V | Promise<V>): V | Promise<V> {
        const existing = this.get(key);
        if (existing !== undefined) {
            return existing;
        }

        const computed = computeFn();

        if (computed instanceof Promise) {
            return computed.then((value) => {
                this.set(key, value);
                return value;
            });
        }

        this.set(key, computed);
        return computed;
    }

    /**
     * Set multiple entries at once.
     *
     * @param entries - Array of [key, value] tuples
     * 
     * @DE
     * Setze mehrere Einträge auf einmal.
     *
     * @param entries - Array von [Schlüssel, Wert] Tupeln
     *
     * @example
     * ```typescript
     * cache.setMany([
     *   ['key1', 'value1'],
     *   ['key2', 'value2']
     * ]);
     * ```
     */
    setMany(entries: Array<[K, V]>): void {
        for (const [key, value] of entries) {
            this.set(key, value);
        }
    }

    /**
     * Get multiple entries at once.
     *
     * @param keys - Array of keys to retrieve
     * @returns Map of found entries
     * 
     * @DE
     * Hole mehrere Einträge auf einmal.
     *
     * @param keys - Array von Schlüsseln zum Abrufen
     * @returns Map der gefundenen Einträge
     *
     * @example
     * ```typescript
     * const results = cache.getMany(['key1', 'key2']);
     * ```
     */
    getMany(keys: K[]): Map<K, V> {
        const results = new Map<K, V>();
        for (const key of keys) {
            const value = this.get(key);
            if (value !== undefined) {
                results.set(key, value);
            }
        }
        return results;
    }

    /**
     * Peek at multiple entries without updating LRU.
     *
     * @param keys - Array of keys to peek at
     * @returns Map of found entries
     * 
     * @DE
     * Schau dir mehrere Einträge an ohne LRU zu aktualisieren.
     *
     * @param keys - Array von Schlüsseln zum Reinschauen
     * @returns Map der gefundenen Einträge
     *
     * @example
     * ```typescript
     * const results = cache.peekMany(['key1', 'key2']);
     * ```
     */
    peekMany(keys: K[]): Map<K, V> {
        const results = new Map<K, V>();
        for (const key of keys) {
            const value = this.peek(key);
            if (value !== undefined) {
                results.set(key, value);
            }
        }
        return results;
    }

    /**
     * Delete multiple entries at once.
     *
     * @param keys - Array of keys to delete
     * @returns Number of entries deleted
     * 
     * @DE
     * Lösche mehrere Einträge auf einmal.
     *
     * @param keys - Array von Schlüsseln zum Löschen
     * @returns Anzahl der gelöschten Einträge
     *
     * @example
     * ```typescript
     * const deleted = cache.deleteMany(['key1', 'key2']);
     * ```
     */
    deleteMany(keys: K[]): number {
        let deleted = 0;
        for (const key of keys) {
            if (this.delete(key)) deleted++;
        }
        return deleted;
    }

    /**
     * Check existence of multiple keys.
     *
     * @param keys - Array of keys to check
     * @returns Map of key existence status
     * 
     * @DE
     * Prüfe Existenz mehrerer Schlüssel.
     *
     * @param keys - Array von Schlüsseln zum Prüfen
     * @returns Map des Schlüssel-Existenz-Status
     *
     * @example
     * ```typescript
     * const exists = cache.hasMany(['key1', 'key2']);
     * ```
     */
    hasMany(keys: K[]): Map<K, boolean> {
        const results = new Map<K, boolean>();
        for (const key of keys) {
            results.set(key, this.has(key));
        }
        return results;
    }

    /**
     * Delete entries matching a pattern (for string keys).
     *
     * @param pattern - Regular expression pattern
     * @returns Number of entries deleted
     * 
     * @DE
     * Lösche Einträge, die einem Muster entsprechen (für String-Schlüssel).
     *
     * @param pattern - Regular Expression Muster
     * @returns Anzahl der gelöschten Einträge
     *
     * @example
     * ```typescript
     * cache.deleteByPattern(/^user:/); // Delete all user keys
     * ```
     */
    deleteByPattern(pattern: RegExp): number {
        let deleted = 0;
        const keysToDelete: K[] = [];

        for (const key of this.cache.keys()) {
            if (typeof key === 'string' && pattern.test(key)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            if (this.delete(key)) deleted++;
        }

        return deleted;
    }

    /**
     * Filter cache entries by predicate.
     *
     * @param predicate - Function to test each entry
     * 
     * @DE
     * Filtere Cache-Einträge nach Prädikat.
     *
     * @param predicate - Funktion zum Testen jedes Eintrags
     *
     * @example
     * ```typescript
     * cache.filter((key, value) => value.active);
     * ```
     */
    filter(predicate: (key: K, value: V) => boolean): void {
        const keysToDelete: K[] = [];

        for (const [key, entry] of this.cache) {
            if (!predicate(key, entry.value)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.delete(key);
        }
    }

    /**
     * Returns an iterator of all keys in the cache.
     *
     * Expired entries are automatically pruned before iteration.
     *
     * @returns An iterator of cache keys
     * 
     * @DE
     * Gibt einen Iterator aller Schlüssel im Cache zurück.
     *
     * Abgelaufene Einträge werden automatisch vor der Iteration entfernt.
     *
     * @returns Ein Iterator der Cache-Schlüssel
     *
     * @example
     * ```typescript
     * for (const key of cache.keys()) {
     *   console.log(key);
     * }
     * ```
     */
    keys(): IterableIterator<K> {
        this.pruneExpired();
        return this.cache.keys();
    }

    /**
     * Returns an iterator of all values in the cache.
     *
     * Expired entries are automatically pruned before iteration.
     *
     * @returns An iterator of cache values
     * 
     * @DE
     * Gibt einen Iterator aller Werte im Cache zurück.
     *
     * Abgelaufene Einträge werden automatisch vor der Iteration entfernt.
     *
     * @returns Ein Iterator der Cache-Werte
     *
     * @example
     * ```typescript
     * for (const value of cache.values()) {
     *   console.log(value);
     * }
     * ```
     */
    values(): IterableIterator<V> {
        this.pruneExpired();

        const self = this;
        const iterator = this.cache.values();

        return {
            [Symbol.iterator]() {
                return this;
            },
            next() {
                let result = iterator.next();

                while (!result.done) {
                    const entry = result.value;
                    if (!self.isExpired(entry)) {
                        return {
                            value: entry.value,
                            done: false,
                        };
                    }
                    result = iterator.next();
                }

                return {value: undefined, done: true};
            },
        } as IterableIterator<V>;
    }

    /**
     * Returns an iterator of all key-value pairs in the cache.
     *
     * Expired entries are automatically pruned before iteration.
     *
     * @returns An iterator of [key, value] tuples
     * 
     * @DE
     * Gibt einen Iterator aller Schlüssel-Wert-Paare im Cache zurück.
     *
     * Abgelaufene Einträge werden automatisch vor der Iteration entfernt.
     *
     * @returns Ein Iterator von [Schlüssel, Wert] Tupeln
     *
     * @example
     * ```typescript
     * for (const [key, value] of cache.entries()) {
     *   console.log(key, value);
     * }
     * ```
     */
    entries(): IterableIterator<[K, V]> {
        this.pruneExpired();
        const self = this;
        const iterator = this.cache.entries();

        return {
            [Symbol.iterator]() {
                return this;
            },
            next() {
                let result = iterator.next();
                while (!result.done) {
                    const [key, entry] = result.value;
                    if (!self.isExpired(entry)) {
                        return {
                            value: [key, entry.value] as [K, V],
                            done: false,
                        };
                    }
                    result = iterator.next();
                }
                return {value: undefined, done: true};
            },
        } as IterableIterator<[K, V]>;
    }

    /**
     * Executes a provided function once for each cache entry.
     *
     * Expired entries are automatically pruned before iteration.
     *
     * @param callback - Function to execute for each entry
     * 
     * @DE
     * Führt eine bereitgestellte Funktion einmal für jeden Cache-Eintrag aus.
     *
     * Abgelaufene Einträge werden automatisch vor der Iteration entfernt.
     *
     * @param callback - Funktion, die für jeden Eintrag ausgeführt wird
     *
     * @example
     * ```typescript
     * cache.forEach((value, key) => {
     *   console.log(`${key}: ${value}`);
     * });
     * ```
     */
    forEach(callback: (value: V, key: K, map: this) => void): void {
        this.pruneExpired();
        for (const [key, entry] of this.cache) {
            if (!this.isExpired(entry)) {
                callback(entry.value, key, this);
            }
        }
    }

    /**
     * Get cache statistics.
     *
     * @returns Cache statistics object
     * 
     * @DE
     * Hole Cache-Statistiken.
     *
     * @returns Cache-Statistik-Objekt
     *
     * @example
     * ```typescript
     * const stats = cache.getStats();
     * console.log(`Hit rate: ${stats.hitRate * 100}%`);
     * ```
     */
    getStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: total > 0 ? this.stats.hits / total : 0,
            evictions: this.stats.evictions,
            expirations: this.stats.expirations,
            size: this.size,
            maxSize: this.maxSize,
            memoryUsage: this.maxMemoryBytes ? this.currentMemoryUsage : undefined,
            maxMemory: this.maxMemoryBytes,
        };
    }

    /**
     * Reset cache statistics.
     * 
     * @DE
     * Setze Cache-Statistiken zurück.
     *
     * @example
     * ```typescript
     * cache.resetStats();
     * ```
     */
    resetStats(): void {
        this.stats = {hits: 0, misses: 0, evictions: 0, expirations: 0};
    }

    /**
     * Register an event listener.
     *
     * @param event - Event type
     * @param callback - Callback function
     * 
     * @DE
     * Registriere einen Event-Listener.
     *
     * @param event - Event-Typ
     * @param callback - Callback-Funktion
     *
     * @example
     * ```typescript
     * cache.on('evict', (key, value, reason) => {
     *   console.log(`Evicted ${key} due to ${reason}`);
     * });
     * ```
     */
    on<E extends CacheEventType>(
        event: E,
        callback: CacheEventCallback<K, V>[E]
    ): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    /**
     * Remove an event listener.
     *
     * @param event - Event type
     * @param callback - Callback function to remove
     * 
     * @DE
     * Entferne einen Event-Listener.
     *
     * @param event - Event-Typ
     * @param callback - Callback-Funktion zum Entfernen
     *
     * @example
     * ```typescript
     * cache.off('evict', myCallback);
     * ```
     */
    off<E extends CacheEventType>(
        event: E,
        callback: CacheEventCallback<K, V>[E]
    ): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Serialize cache to JSON.
     *
     * @returns Serialized cache data
     * 
     * @DE
     * Serialisiere Cache zu JSON.
     *
     * @returns Serialisierte Cache-Daten
     *
     * @example
     * ```typescript
     * const json = cache.toJSON();
     * ```
     */
    toJSON(): SerializedCache<K, V> {
        return {
            maxSize: this.maxSize,
            maxMemoryBytes: this.maxMemoryBytes,
            ttl: this.ttl,
            slidingTTL: this.slidingTTL,
            maxTTL: this.maxTTL,
            entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
                key,
                value: entry.value,
                expiry: entry.expiry,
                createdAt: entry.createdAt,
                size: entry.size,
            })),
            keyOrder: this.keyOrder.keys(),
            stats: this.enableStats ? this.getStats() : undefined,
        };
    }

    /**
     * Dispose of the cache and cleanup resources.
     * 
     * @DE
     * Entsorge den Cache und räume Ressourcen auf.
     *
     * @example
     * ```typescript
     * cache.dispose();
     * ```
     */
    dispose(): void {
        this.stopCleanupTimer();
        this.clear();
        this.eventListeners.clear();
    }

    /**
     * Checks if a cache entry has expired.
     *
     * @param entry - The cache entry to check
     * @returns True if the entry has expired, false otherwise
     * @private
     */
    private isExpired(entry: CacheEntry<V>): boolean {
        return Date.now() > entry.expiry;
    }

    /**
     * Evicts the oldest (least recently used) entry from the cache.
     *
     * @param reason - Reason for eviction ('size' or 'memory')
     * @private
     */
    private evictOldest(reason: 'size' | 'memory'): void {
        const oldest = this.keyOrder.shift();
        if (oldest !== undefined) {
            const entry = this.cache.get(oldest);
            if (entry) {
                this.cache.delete(oldest);
                if (entry.size) {
                    this.currentMemoryUsage -= entry.size;
                }
                if (this.enableStats) this.stats.evictions++;
                this.emit('evict', oldest, entry.value, reason);
            }
        }
    }

    /**
     * Delete an entry and emit appropriate event.
     *
     * @param key - Key to delete
     * @param entry - Entry being deleted
     * @param type - Type of deletion
     * @returns True if deleted
     * @private
     */
    private deleteEntry(
        key: K,
        entry: CacheEntry<V>,
        type: 'delete' | 'expire'
    ): boolean {
        this.keyOrder.remove(key);
        this.cache.delete(key);

        if (entry.size) {
            this.currentMemoryUsage -= entry.size;
        }

        if (type === 'expire') {
            if (this.enableStats) this.stats.expirations++;
            this.emit('expire', key, entry.value);
        } else {
            this.emit('delete', key, entry.value);
        }

        return true;
    }

    /**
     * Removes all expired entries from the cache.
     *
     * @private
     */
    private pruneExpired(): void {
        const keysToDelete: K[] = [];

        for (const [key, entry] of this.cache) {
            if (
                this.isExpired(entry) ||
                (this.maxTTL && Date.now() - entry.createdAt > this.maxTTL)
            ) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            const entry = this.cache.get(key);
            if (entry) {
                this.deleteEntry(key, entry, 'expire');
            }
        }
    }

    /**
     * Start background cleanup timer.
     *
     * @private
     */
    private startCleanupTimer(): void {
        this.cleanupInterval = setInterval(() => {
            this.pruneExpired();
        }, this.cleanupIntervalMs);

        // Prevent Node.js from hanging
        if (typeof (this.cleanupInterval as any).unref === 'function') {
            (this.cleanupInterval as any).unref();
        }
    }

    /**
     * Stop background cleanup timer.
     *
     * @private
     */
    private stopCleanupTimer(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Estimate memory size of a value in bytes.
     *
     * @param value - Value to estimate
     * @returns Estimated size in bytes
     * @private
     */
    private estimateSize(value: V): number {
        try {
            const str = JSON.stringify(value);
            // UTF-16 uses 2 bytes per character
            return str.length * 2;
        } catch {
            // Fallback for non-serializable objects
            return 1024; // 1KB default estimate
        }
    }

    /**
     * Emit an event to all registered listeners.
     *
     * @param event - Event type
     * @param args - Event arguments
     * @private
     */
    private emit(event: CacheEventType, ...args: any[]): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                listener(...args);
            }
        }
    }
}