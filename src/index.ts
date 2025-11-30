/**
 * @notkeira/ttl-cache
 *
 * A lightweight LRU (Least Recently Used) cache implementation with optional
 * TTL (Time To Live) support and discord.js Collection compatibility.
 *
 * @module @notkeira/ttl-cache
 * @licence MIT
 * @author Keira Hopkins
 * 
 * @DE
 * Eine leichtgewichtige LRU (Least Recently Used) Cache-Implementierung mit optionaler
 * TTL (Time To Live) Unterstützung und discord.js Collection Kompatibilität.
 *
 * @example
 * ```typescript
 * import { LRUCache } from '@notkeira/ttl-cache';
 *
 * const cache = new LRUCache<string, number>({
 *   maxSize: 100,
 *   ttl: 60000, // 1 minute
 *   enableStats: true,
 *   slidingTTL: true
 * });
 *
 * cache.set('key', 123);
 * const value = cache.get('key'); // 123
 *
 * // Check statistics
 * const stats = cache.getStats();
 * console.log(`Hit rate: ${stats.hitRate * 100}%`);
 * ```
 */

// Core cache implementation
export {LRUCache} from './cache/lru';
export {NamespacedCache} from './cache/namespaced-cache';

// Type definitions
export type {
    CacheEntry,
    LRUCacheOptions,
    CacheStats,
    SerializedCache,
    CacheEventType,
    CacheEventCallback,
} from './types';

// Node utilities
export {LRUNode, LRUList} from './node/lru-node';

// Entry utilities
export {
    createCacheEntry,
    isCacheEntryExpired,
    getCacheEntryTTL,
    getCacheEntryAge,
} from './entry';

// Collection utilities
export {
    loadDiscordCollection,
    isDiscordAvailable,
    validateDiscordCollection,
} from './utils';