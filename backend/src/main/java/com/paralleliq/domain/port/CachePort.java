package com.paralleliq.domain.port;

import java.time.Duration;
import java.util.Optional;

/**
 * Abstraction over the caching layer.
 *
 * Default implementation: CaffeineCacheAdapter (zero extra infrastructure)
 * Scale-out implementation: RedisCacheAdapter (activate via paralleliq.cache.provider=redis)
 *
 * Domain and Application layers call this port only — never Caffeine or Redis directly.
 */
public interface CachePort {

    /**
     * Retrieve a cached value by key.
     * Returns empty if key is not present or TTL has expired.
     */
    <T> Optional<T> get(String key, Class<T> type);

    /**
     * Store a value with explicit TTL.
     */
    <T> void put(String key, T value, Duration ttl);

    /**
     * Remove a specific key.
     */
    void evict(String key);

    /**
     * Remove all keys matching a prefix pattern.
     * e.g. evictByPrefix("lookup:products:") clears all product lookup cache entries.
     */
    void evictByPrefix(String prefix);

    // ── Key helpers — use these constants everywhere ──────────────

    static String lookupKey(String definitionName, String lookupKey) {
        return "lookup:" + definitionName + ":" + lookupKey;
    }

    static String environmentKey(String environmentId) {
        return "env:" + environmentId;
    }

    static String ruleSetLatestKey(String name) {
        return "ruleset:latest:" + name;
    }

    static String assertionSetLatestKey(String name) {
        return "assertionset:latest:" + name;
    }
}
