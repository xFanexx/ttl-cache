import type {CacheEntry} from './types';

/**
 * Creates a new cache entry with the given value and expiration time.
 *
 * @template V - The type of the cached value
 * @param value - The value to cache
 * @param expiry - Unix timestamp (in milliseconds) when this entry expires
 * @param size - Optional size in bytes
 * @returns A new cache entry
 * 
 * @DE
 * Erstellt einen neuen Cache-Eintrag mit dem gegebenen Wert und Ablaufzeit.
 *
 * @template V - Der Typ des gecachten Werts
 * @param value - Der zu cachende Wert
 * @param expiry - Unix-Zeitstempel (in Millisekunden), wann dieser Eintrag abläuft
 * @param size - Optionale Größe in Bytes
 * @returns Ein neuer Cache-Eintrag
 *
 * @example
 * ```typescript
 * const entry = createCacheEntry('value', Date.now() + 60000);
 * ```
 */
export function createCacheEntry<V>(
    value: V,
    expiry: number = Infinity,
    size?: number
): CacheEntry<V> {
    return {
        value,
        expiry,
        createdAt: Date.now(),
        size,
    };
}

/**
 * Checks if a cache entry has expired.
 *
 * @template V - The type of the cached value
 * @param entry - The cache entry to check
 * @returns True if the entry has expired, false otherwise
 * 
 * @DE
 * Überprüft, ob ein Cache-Eintrag abgelaufen ist.
 *
 * @template V - Der Typ des gecachten Werts
 * @param entry - Der zu prüfende Cache-Eintrag
 * @returns True wenn der Eintrag abgelaufen ist, sonst false
 *
 * @example
 * ```typescript
 * if (isCacheEntryExpired(entry)) {
 *   console.log('Entry has expired');
 * }
 * ```
 */
export function isCacheEntryExpired<V>(entry: CacheEntry<V>): boolean {
    return Date.now() > entry.expiry;
}

/**
 * Gets the remaining time-to-live for a cache entry in milliseconds.
 *
 * @template V - The type of the cached value
 * @param entry - The cache entry to check
 * @returns The remaining TTL in milliseconds, or Infinity if the entry has no expiry
 * 
 * @DE
 * Gibt die verbleibende Lebenszeit für einen Cache-Eintrag in Millisekunden zurück.
 *
 * @template V - Der Typ des gecachten Werts
 * @param entry - Der zu prüfende Cache-Eintrag
 * @returns Die verbleibende TTL in Millisekunden, oder Infinity wenn der Eintrag kein Ablaufen hat
 *
 * @example
 * ```typescript
 * const ttl = getCacheEntryTTL(entry);
 * console.log(`Entry expires in ${ttl}ms`);
 * ```
 */
export function getCacheEntryTTL<V>(entry: CacheEntry<V>): number {
    if (entry.expiry === Infinity) {
        return Infinity;
    }
    return Math.max(0, entry.expiry - Date.now());
}

/**
 * Gets the age of a cache entry in milliseconds.
 *
 * @template V - The type of the cached value
 * @param entry - The cache entry to check
 * @returns The age in milliseconds
 * 
 * @DE
 * Gibt das Alter eines Cache-Eintrags in Millisekunden zurück.
 *
 * @template V - Der Typ des gecachten Werts
 * @param entry - Der zu prüfende Cache-Eintrag
 * @returns Das Alter in Millisekunden
 *
 * @example
 * ```typescript
 * const age = getCacheEntryAge(entry);
 * console.log(`Entry is ${age}ms old`);
 * ```
 */
export function getCacheEntryAge<V>(entry: CacheEntry<V>): number {
    return Date.now() - entry.createdAt;
}