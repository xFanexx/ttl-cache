/**
 * Node in the doubly linked list for O(1) LRU operations
 *
 * @template K - The type of keys in the cache
 * 
 * @DE
 * Node in der doppelt verketteten Liste für O(1) LRU-Operationen
 *
 * @template K - Der Typ der Schlüssel im Cache
 */
export class LRUNode<K> {
    key: K;
    prev: LRUNode<K> | null = null;
    next: LRUNode<K> | null = null;

    constructor(key: K) {
        this.key = key;
    }
}

/**
 * Doubly linked list for efficient LRU tracking
 *
 * @template K - The type of keys in the cache
 * 
 * @DE
 * Doppelt verkettete Liste für effizientes LRU-Tracking
 *
 * @template K - Der Typ der Schlüssel im Cache
 */
export class LRUList<K> {
    private head: LRUNode<K> | null = null;
    private tail: LRUNode<K> | null = null;
    private nodeMap: Map<K, LRUNode<K>> = new Map();
    private _size = 0;

    /**
     * Get the current size of the list
     * 
     * @DE
     * Hole die aktuelle Größe der Liste
     */
    get size(): number {
        return this._size;
    }

    /**
     * Add a key to the end of the list (most recently used)
     * 
     * @DE
     * Füge einen Schlüssel ans Ende der Liste hinzu (zuletzt verwendet)
     */
    push(key: K): void {
        if (this.nodeMap.has(key)) {
            this.moveToEnd(key);
            return;
        }

        const node = new LRUNode(key);
        this.nodeMap.set(key, node);

        if (!this.head) {
            this.head = this.tail = node;
        } else {
            node.prev = this.tail;
            if (this.tail) {
                this.tail.next = node;
            }
            this.tail = node;
        }

        this._size++;
    }

    /**
     * Move a key to the end of the list (most recently used)
     * 
     * @DE
     * Verschiebe einen Schlüssel ans Ende der Liste (zuletzt verwendet)
     */
    moveToEnd(key: K): void {
        const node = this.nodeMap.get(key);
        if (!node || node === this.tail) {
            return;
        }

        // Remove from current position
        if (node.prev) {
            node.prev.next = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
        if (node === this.head) {
            this.head = node.next;
        }

        // Move to tail
        node.prev = this.tail;
        node.next = null;
        if (this.tail) {
            this.tail.next = node;
        }
        this.tail = node;

        if (!this.head) {
            this.head = node;
        }
    }

    /**
     * Remove the least recently used key (head of list)
     * 
     * @DE
     * Entferne den am längsten nicht verwendeten Schlüssel (Kopf der Liste)
     */
    shift(): K | undefined {
        if (!this.head) {
            return undefined;
        }

        const key = this.head.key;
        this.remove(key);
        return key;
    }

    /**
     * Remove a specific key from the list
     * 
     * @DE
     * Entferne einen spezifischen Schlüssel aus der Liste
     */
    remove(key: K): boolean {
        const node = this.nodeMap.get(key);
        if (!node) {
            return false;
        }

        if (node.prev) {
            node.prev.next = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
        if (node === this.head) {
            this.head = node.next;
        }
        if (node === this.tail) {
            this.tail = node.prev;
        }

        this.nodeMap.delete(key);
        this._size--;
        return true;
    }

    /**
     * Check if a key exists in the list
     * 
     * @DE
     * Prüfe ob ein Schlüssel in der Liste existiert
     */
    has(key: K): boolean {
        return this.nodeMap.has(key);
    }

    /**
     * Clear all nodes from the list
     * 
     * @DE
     * Lösche alle Nodes aus der Liste
     */
    clear(): void {
        this.head = null;
        this.tail = null;
        this.nodeMap.clear();
        this._size = 0;
    }

    /**
     * Get all keys in order (LRU to MRU)
     * 
     * @DE
     * Hole alle Schlüssel in Reihenfolge (LRU zu MRU)
     */
    keys(): K[] {
        const keys: K[] = [];
        let current = this.head;
        while (current) {
            keys.push(current.key);
            current = current.next;
        }
        return keys;
    }
}