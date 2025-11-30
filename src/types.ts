/**
 * Represents a single entry in the cache with its value and expiration time.
 *
 * @template V - The type of the cached value
 * 
 * @DE
 * Repräsentiert einen einzelnen Eintrag im Cache mit seinem Wert und Ablaufzeit.
 *
 * @template V - Der Typ des gecachten Werts
 */
export interface CacheEntry<V> {
    /**
     * The cached value
     * 
     * @DE
     * Der gecachte Wert
     */
    value: V;

    /**
     * Unix timestamp (in milliseconds) when this entry expires.
     * Set to Infinity for entries without TTL.
     * 
     * @DE
     * Unix-Zeitstempel (in Millisekunden), wann dieser Eintrag abläuft.
     * Setze auf Infinity für Einträge ohne TTL.
     */
    expiry: number;

    /**
     * Unix timestamp (in milliseconds) when this entry was created.
     * Used for absolute max TTL calculations.
     * 
     * @DE
     * Unix-Zeitstempel (in Millisekunden), wann dieser Eintrag erstellt wurde.
     * Wird für absolute max TTL Berechnungen verwendet.
     */
    createdAt: number;

    /**
     * Estimated size in bytes (used for memory-based eviction)
     * 
     * @DE
     * Geschätzte Größe in Bytes (wird für speicherbasierte Entfernung verwendet)
     */
    size?: number;
}

/**
 * Configuration options for creating an LRU cache instance.
 * 
 * @DE
 * Konfigurationsoptionen zum Erstellen einer LRU-Cache-Instanz.
 */
export interface LRUCacheOptions {
    /**
     * Maximum number of entries the cache can hold.
     * When this limit is reached, the least recently used entry will be evicted.
     * Can be omitted if maxMemoryBytes is specified.
     * 
     * @DE
     * Maximale Anzahl an Einträgen, die der Cache halten kann.
     * Wenn dieses Limit erreicht wird, wird der am längsten nicht verwendete Eintrag entfernt.
     * Kann weggelassen werden, wenn maxMemoryBytes angegeben ist.
     */
    maxSize?: number;

    /**
     * Maximum memory usage in bytes.
     * When this limit is reached, entries will be evicted until memory is available.
     * 
     * @DE
     * Maximale Speichernutzung in Bytes.
     * Wenn dieses Limit erreicht wird, werden Einträge entfernt, bis Speicher verfügbar ist.
     */
    maxMemoryBytes?: number;

    /**
     * Time-to-live for cache entries in milliseconds.
     * If not specified, entries will not expire based on time.
     *
     * @default undefined
     * 
     * @DE
     * Lebenszeit für Cache-Einträge in Millisekunden.
     * Wenn nicht angegeben, laufen Einträge nicht zeitbasiert ab.
     */
    ttl?: number;

    /**
     * Whether to use sliding TTL. When enabled, accessing an entry
     * resets its TTL to the full duration.
     *
     * @default false
     * 
     * @DE
     * Ob du sliding TTL verwenden möchtest. Wenn aktiviert, wird beim Zugriff auf einen Eintrag
     * dessen TTL auf die volle Dauer zurückgesetzt.
     */
    slidingTTL?: boolean;

    /**
     * Maximum absolute lifetime for entries in milliseconds.
     * Entries will be evicted after this time regardless of access.
     *
     * @default undefined
     * 
     * @DE
     * Maximale absolute Lebensdauer für Einträge in Millisekunden.
     * Einträge werden nach dieser Zeit entfernt, unabhängig vom Zugriff.
     */
    maxTTL?: number;

    /**
     * Whether to use discord.js Collection as the underlying storage.
     * Requires discord.js to be installed as a peer dependency.
     *
     * @default false
     * 
     * @DE
     * Ob du discord.js Collection als zugrunde liegende Speicherung verwenden möchtest.
     * Erfordert, dass discord.js als Peer-Dependency installiert ist.
     */
    useCollection?: boolean;

    /**
     * Enable automatic background cleanup of expired entries.
     *
     * @default false
     * 
     * @DE
     * Aktiviere automatisches Aufräumen abgelaufener Einträge im Hintergrund.
     */
    autoCleanup?: boolean;

    /**
     * Interval in milliseconds for automatic cleanup.
     * Only used when autoCleanup is enabled.
     *
     * @default 60000 (1 minute)
     * 
     * @DE
     * Intervall in Millisekunden für automatisches Aufräumen.
     * Wird nur verwendet, wenn autoCleanup aktiviert ist.
     */
    cleanupInterval?: number;

    /**
     * Enable cache statistics tracking.
     *
     * @default false
     * 
     * @DE
     * Aktiviere Cache-Statistik-Tracking.
     */
    enableStats?: boolean;
}

/**
 * Cache statistics information
 * 
 * @DE
 * Cache-Statistik-Informationen
 */
export interface CacheStats {
    /**
     * Number of successful cache hits
     * 
     * @DE
     * Anzahl der erfolgreichen Cache-Treffer
     */
    hits: number;

    /**
     * Number of cache misses
     * 
     * @DE
     * Anzahl der Cache-Fehlschläge
     */
    misses: number;

    /**
     * Cache hit rate (0-1)
     * 
     * @DE
     * Cache-Trefferrate (0-1)
     */
    hitRate: number;

    /**
     * Number of evictions due to size/memory limits
     * 
     * @DE
     * Anzahl der Entfernungen aufgrund von Größen-/Speicherlimits
     */
    evictions: number;

    /**
     * Number of entries that expired
     * 
     * @DE
     * Anzahl der abgelaufenen Einträge
     */
    expirations: number;

    /**
     * Current cache size
     * 
     * @DE
     * Aktuelle Cache-Größe
     */
    size: number;

    /**
     * Maximum cache size
     * 
     * @DE
     * Maximale Cache-Größe
     */
    maxSize: number | undefined;

    /**
     * Current memory usage in bytes (if memory tracking enabled)
     * 
     * @DE
     * Aktuelle Speichernutzung in Bytes (wenn Speicher-Tracking aktiviert ist)
     */
    memoryUsage?: number;

    /**
     * Maximum memory in bytes (if memory tracking enabled)
     * 
     * @DE
     * Maximaler Speicher in Bytes (wenn Speicher-Tracking aktiviert ist)
     */
    maxMemory?: number;
}

/**
 * Serialized cache data for export/import
 * 
 * @DE
 * Serialisierte Cache-Daten für Export/Import
 */
export interface SerializedCache<K, V> {
    maxSize?: number;
    maxMemoryBytes?: number;
    ttl: number | null;
    slidingTTL: boolean;
    maxTTL: number | null;
    entries: Array<{
        key: K;
        value: V;
        expiry: number;
        createdAt: number;
        size?: number;
    }>;
    keyOrder: K[];
    stats?: CacheStats;
}

/**
 * Cache event types
 * 
 * @DE
 * Cache-Event-Typen
 */
export type CacheEventType = 'set' | 'delete' | 'clear' | 'evict' | 'expire';

/**
 * Cache event callback
 * 
 * @DE
 * Cache-Event-Callback
 */
export type CacheEventCallback<K, V> = {
    set: (key: K, value: V, isUpdate: boolean) => void;
    delete: (key: K, value: V) => void;
    clear: () => void;
    evict: (key: K, value: V, reason: 'size' | 'memory') => void;
    expire: (key: K, value: V) => void;
};