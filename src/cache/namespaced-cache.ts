import {LRUCache} from './lru';

/**
 * Namespaced cache wrapper for logical separation.
 *
 * @template K - The type of keys in the cache
 * @template V - The type of values in the cache
 * 
 * @DE
 * Namespace-Cache-Wrapper für logische Trennung.
 *
 * @template K - Der Typ der Schlüssel im Cache
 * @template V - Der Typ der Werte im Cache
 *
 * @example
 * ```typescript
 * const cache = new LRUCache({ maxSize: 100 });
 * const userCache = cache.namespace('users');
 * const postCache = cache.namespace('posts');
 *
 * userCache.set('123', userData);
 * postCache.set('123', postData);
 * ```
 */
export class NamespacedCache<K, V> {
    constructor(
        private parent: LRUCache<string, V>,
        private prefix: string
    ) {
    }

    /**
     * Set a value in the namespaced cache.
     *
     * @param key - The key to set
     * @param value - The value to cache
     * 
     * @DE
     * Setze einen Wert im Namespace-Cache.
     *
     * @param key - Der zu setzende Schlüssel
     * @param value - Der zu cachende Wert
     */
    set(key: K, value: V): void {
        this.parent.set(this.prefixKey(key), value);
    }

    /**
     * Set a value with custom TTL.
     *
     * @param key - The key to set
     * @param value - The value to cache
     * @param ttl - Custom TTL in milliseconds
     * 
     * @DE
     * Setze einen Wert mit benutzerdefinierter TTL.
     *
     * @param key - Der zu setzende Schlüssel
     * @param value - Der zu cachende Wert
     * @param ttl - Benutzerdefinierte TTL in Millisekunden
     */
    setWithTTL(key: K, value: V, ttl: number): void {
        this.parent.setWithTTL(this.prefixKey(key), value, ttl);
    }

    /**
     * Get a value from the namespaced cache.
     *
     * @param key - The key to retrieve
     * @returns The cached value, or undefined if not found
     * 
     * @DE
     * Hole einen Wert aus dem Namespace-Cache.
     *
     * @param key - Der abzurufende Schlüssel
     * @returns Der gecachte Wert, oder undefined wenn nicht gefunden
     */
    get(key: K): V | undefined {
        return this.parent.get(this.prefixKey(key));
    }

    /**
     * Peek at a value without updating LRU.
     *
     * @param key - The key to peek at
     * @returns The cached value, or undefined if not found
     * 
     * @DE
     * Schau dir einen Wert an ohne LRU zu aktualisieren.
     *
     * @param key - Der Schlüssel zum Reinschauen
     * @returns Der gecachte Wert, oder undefined wenn nicht gefunden
     */
    peek(key: K): V | undefined {
        return this.parent.peek(this.prefixKey(key));
    }

    /**
     * Check if a key exists.
     *
     * @param key - The key to check
     * @returns True if the key exists and is valid
     * 
     * @DE
     * Prüfe ob ein Schlüssel existiert.
     *
     * @param key - Der zu prüfende Schlüssel
     * @returns True wenn der Schlüssel existiert und gültig ist
     */
    has(key: K): boolean {
        return this.parent.has(this.prefixKey(key));
    }

    /**
     * Delete a key.
     *
     * @param key - The key to remove
     * @returns True if the entry was removed
     * 
     * @DE
     * Lösche einen Schlüssel.
     *
     * @param key - Der zu entfernende Schlüssel
     * @returns True wenn der Eintrag entfernt wurde
     */
    delete(key: K): boolean {
        return this.parent.delete(this.prefixKey(key));
    }

    /**
     * Get remaining TTL for a key.
     *
     * @param key - The key to check
     * @returns Remaining TTL in milliseconds
     * 
     * @DE
     * Hole verbleibende TTL für einen Schlüssel.
     *
     * @param key - Der zu prüfende Schlüssel
     * @returns Verbleibende TTL in Millisekunden
     */
    getTTL(key: K): number | null {
        return this.parent.getTTL(this.prefixKey(key));
    }

    /**
     * Update TTL for a key.
     *
     * @param key - The key to update
     * @param ttl - New TTL in milliseconds
     * @returns True if the entry was updated
     * 
     * @DE
     * Aktualisiere TTL für einen Schlüssel.
     *
     * @param key - Der zu aktualisierende Schlüssel
     * @param ttl - Neue TTL in Millisekunden
     * @returns True wenn der Eintrag aktualisiert wurde
     */
    touch(key: K, ttl?: number): boolean {
        return this.parent.touch(this.prefixKey(key), ttl);
    }

    /**
     * Get or compute a value.
     *
     * @param key - The key to get or compute
     * @param computeFn - Function to compute the value if not cached
     * @returns The cached or computed value
     * 
     * @DE
     * Hole oder berechne einen Wert.
     *
     * @param key - Der zu holende oder berechnende Schlüssel
     * @param computeFn - Funktion zum Berechnen des Werts, wenn er nicht gecacht ist
     * @returns Der gecachte oder berechnete Wert
     */
    getOrCompute(key: K, computeFn: () => V | Promise<V>): V | Promise<V> {
        return this.parent.getOrCompute(this.prefixKey(key), computeFn);
    }

    /**
     * Clear all entries in this namespace.
     * 
     * @DE
     * Lösche alle Einträge in diesem Namespace.
     */
    clear(): void {
        this.parent.deleteByPattern(new RegExp(`^${this.prefix}:`));
    }

    /**
     * Create a prefixed key.
     *
     * @param key - Original key
     * @returns Prefixed key
     * @private
     */
    private prefixKey(key: K): string {
        return `${this.prefix}:${String(key)}`;
    }
}