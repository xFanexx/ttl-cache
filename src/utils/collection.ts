/**
 * Attempts to load the discord.js Collection class.
 *
 * This function dynamically imports discord.js and returns the Collection class.
 * It's used internally by the cache when `useCollection` is set to true.
 *
 * @returns The Collection class from discord.js
 * @throws {Error} If discord.js is not installed or Collection cannot be loaded
 * 
 * @DE
 * Versucht die discord.js Collection Klasse zu laden.
 *
 * Diese Funktion importiert discord.js dynamisch und gibt die Collection Klasse zurück.
 * Sie wird intern vom Cache verwendet, wenn `useCollection` auf true gesetzt ist.
 *
 * @returns Die Collection Klasse von discord.js
 * @throws {Error} Wenn discord.js nicht installiert ist oder Collection nicht geladen werden kann
 *
 * @example
 * ```typescript
 * try {
 *   const Collection = loadDiscordCollection();
 *   const map = new Collection();
 * } catch (error) {
 *   console.error('discord.js not available');
 * }
 * ```
 */
export function loadDiscordCollection(): typeof Map {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const discordjs = require('discord.js');

        if (!discordjs.Collection) {
            throw new Error('Collection class not found in discord.js');
        }

        return discordjs.Collection;
    } catch (error) {
        if (error instanceof Error && error.message.includes('Collection class not found')) {
            throw error;
        }

        throw new Error(
            'discord.js not installed. Set useCollection to false or install discord.js as a peer dependency.'
        );
    }
}

/**
 * Checks if discord.js is available in the current environment.
 *
 * @returns True if discord.js is installed and can be loaded, false otherwise
 * 
 * @DE
 * Überprüft, ob discord.js in der aktuellen Umgebung verfügbar ist.
 *
 * @returns True wenn discord.js installiert ist und geladen werden kann, sonst false
 *
 * @example
 * ```typescript
 * if (isDiscordAvailable()) {
 *   console.log('discord.js is available');
 * }
 * ```
 */
export function isDiscordAvailable(): boolean {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('discord.js');
        return true;
    } catch {
        return false;
    }
}

/**
 * Validates that discord.js Collection is available and functional.
 *
 * This performs a more thorough check than `isDiscordAvailable`,
 * ensuring the Collection class exists and can be instantiated.
 *
 * @returns True if Collection is available and functional, false otherwise
 * 
 * @DE
 * Validiert, dass discord.js Collection verfügbar und funktionsfähig ist.
 *
 * Dies führt eine gründlichere Prüfung als `isDiscordAvailable` durch,
 * stellt sicher, dass die Collection Klasse existiert und instanziiert werden kann.
 *
 * @returns True wenn Collection verfügbar und funktionsfähig ist, sonst false
 *
 * @example
 * ```typescript
 * if (validateDiscordCollection()) {
 *   // Safe to use discord.js Collection
 * }
 * ```
 */
export function validateDiscordCollection(): boolean {
    try {
        const Collection = loadDiscordCollection();
        // Test instantiation
        new Collection();
        return true;
    } catch {
        return false;
    }
}