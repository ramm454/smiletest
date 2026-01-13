// src/modules/cache/advanced-cache.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class AdvancedCacheService {
  private readonly logger = new Logger(AdvancedCacheService.name);
  private redis: Redis;
  private localCache = new Map<string, { value: any; expiry: number }>();
  private pendingRequests = new Map<string, Promise<any>>();
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.setupCleanupInterval();
  }
  
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: {
      ttl?: number; // Time to live in seconds
      tags?: string[]; // Cache tags for invalidation
      context?: any; // Context for cache key generation
      staleWhileRevalidate?: number; // Seconds to serve stale while revalidating
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<T> {
    const cacheKey = this.generateCacheKey(key, options.context);
    
    // Check local cache first
    const localCached = this.localCache.get(cacheKey);
    if (localCached && localCached.expiry > Date.now()) {
      this.logger.debug(`Local cache hit for key: ${cacheKey}`);
      return localCached.value as T;
    }
    
    // Check Redis
    try {
      const redisData = await this.redis.get(cacheKey);
      if (redisData) {
        const parsed = JSON.parse(redisData);
        const now = Date.now();
        
        // Check if stale but can be served while revalidating
        if (parsed.expiry < now && options.staleWhileRevalidate) {
          const staleAge = now - parsed.expiry;
          if (staleAge < options.staleWhileRevalidate * 1000) {
            this.logger.debug(`Serving stale cache for key: ${cacheKey}`);
            
            // Revalidate in background
            this.revalidateInBackground(cacheKey, fetchFn, options);
            
            return parsed.value as T;
          }
        }
        
        if (parsed.expiry > now) {
          this.logger.debug(`Redis cache hit for key: ${cacheKey}`);
          
          // Also store in local cache
          this.localCache.set(cacheKey, {
            value: parsed.value,
            expiry: parsed.expiry
          });
          
          return parsed.value as T;
        }
      }
    } catch (error) {
      this.logger.error('Redis cache error:', error);
    }
    
    // Cache miss - fetch data
    return this.fetchWithDeduplication(cacheKey, fetchFn, options);
  }
  
  private async fetchWithDeduplication<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: any
  ): Promise<T> {
    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(key)) {
      this.logger.debug(`Waiting for pending request for key: ${key}`);
      return this.pendingRequests.get(key) as Promise<T>;
    }
    
    // Create new promise
    const promise = (async () => {
      try {
        const result = await fetchFn();
        
        // Cache the result
        await this.set(key, result, options);
        
        return result;
      } finally {
        // Clean up pending request
        this.pendingRequests.delete(key);
      }
    })();
    
    // Store promise for deduplication
    this.pendingRequests.set(key, promise);
    
    return promise;
  }
  
  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      tags?: string[];
      context?: any;
    } = {}
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(key, options.context);
    const ttl = options.ttl || 3600; // Default 1 hour
    const expiry = Date.now() + (ttl * 1000);
    
    // Store in local cache
    this.localCache.set(cacheKey, { value, expiry });
    
    // Store in Redis
    try {
      await this.redis.setex(
        cacheKey,
        ttl,
        JSON.stringify({ value, expiry, tags: options.tags })
      );
      
      // Store tag relationships for invalidation
      if (options.tags?.length) {
        await this.storeTagRelationships(cacheKey, options.tags);
      }
      
      this.logger.debug(`Cached key: ${cacheKey} with TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error('Redis set error:', error);
    }
  }
  
  async invalidate(key: string, context?: any): Promise<void> {
    const cacheKey = this.generateCacheKey(key, context);
    
    // Remove from local cache
    this.localCache.delete(cacheKey);
    
    // Remove from Redis
    try {
      await this.redis.del(cacheKey);
      this.logger.debug(`Invalidated key: ${cacheKey}`);
    } catch (error) {
      this.logger.error('Redis invalidate error:', error);
    }
  }
  
  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      try {
        const memberKeys = await this.redis.smembers(tagKey);
        
        if (memberKeys.length > 0) {
          // Delete all cache keys associated with this tag
          await this.redis.del(...memberKeys);
          
          // Also delete from local cache
          memberKeys.forEach(key => this.localCache.delete(key));
          
          // Clean up tag set
          await this.redis.del(tagKey);
          
          this.logger.debug(`Invalidated ${memberKeys.length} keys by tag: ${tag}`);
        }
      } catch (error) {
        this.logger.error(`Tag invalidation error for tag ${tag}:`, error);
      }
    }
  }
  
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        
        // Also delete from local cache
        keys.forEach(key => this.localCache.delete(key));
        
        this.logger.debug(`Invalidated ${keys.length} keys by pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error('Pattern invalidation error:', error);
    }
  }
  
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info();
      const lines = info.split('\r\n');
      
      const stats: CacheStats = {
        localCacheSize: this.localCache.size,
        pendingRequests: this.pendingRequests.size,
        redis: {
          connected: this.redis.status === 'ready',
          usedMemory: this.parseRedisInfo(lines, 'used_memory'),
          totalKeys: await this.redis.dbsize(),
          hitRate: await this.calculateHitRate(),
          uptime: this.parseRedisInfo(lines, 'uptime_in_seconds')
        }
      };
      
      return stats;
    } catch (error) {
      this.logger.error('Cache stats error:', error);
      return {
        localCacheSize: this.localCache.size,
        pendingRequests: this.pendingRequests.size,
        redis: { connected: false }
      };
    }
  }
  
  async warmCache(patterns: string[]): Promise<void> {
    this.logger.log('Starting cache warm-up...');
    
    for (const pattern of patterns) {
      try {
        // This would fetch data for common queries and cache them
        // Implementation depends on your application
        this.logger.debug(`Warming cache for pattern: ${pattern}`);
      } catch (error) {
        this.logger.error(`Cache warm-up error for pattern ${pattern}:`, error);
      }
    }
    
    this.logger.log('Cache warm-up completed');
  }
  
  private generateCacheKey(key: string, context?: any): string {
    if (!context) return `cache:${key}`;
    
    // Include context in key generation for contextual caching
    const contextHash = crypto
      .createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 8);
    
    return `cache:${key}:ctx:${contextHash}`;
  }
  
  private async storeTagRelationships(cacheKey: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      await this.redis.sadd(tagKey, cacheKey);
      
      // Set expiry on tag set (slightly longer than cache TTL)
      await this.redis.expire(tagKey, 86400); // 24 hours
    }
  }
  
  private async revalidateInBackground(
    cacheKey: string,
    fetchFn: () => Promise<any>,
    options: any
  ): Promise<void> {
    // Revalidate in background without blocking
    process.nextTick(async () => {
      try {
        const result = await fetchFn();
        await this.set(cacheKey, result, options);
        this.logger.debug(`Background revalidation completed for key: ${cacheKey}`);
      } catch (error) {
        this.logger.error(`Background revalidation failed for key ${cacheKey}:`, error);
      }
    });
  }
  
  private setupCleanupInterval(): void {
    // Clean up expired local cache entries every minute
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, entry] of this.localCache.entries()) {
        if (entry.expiry < now) {
          this.localCache.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        this.logger.debug(`Cleaned ${cleaned} expired local cache entries`);
      }
    }, 60000); // Every minute
  }
  
  private parseRedisInfo(lines: string[], key: string): string | null {
    const line = lines.find(l => l.startsWith(`${key}:`));
    return line ? line.split(':')[1] : null;
  }
  
  private async calculateHitRate(): Promise<number> {
    try {
      const info = await this.redis.info('stats');
      const lines = info.split('\r\n');
      
      const hits = parseInt(this.parseRedisInfo(lines, 'keyspace_hits') || '0');
      const misses = parseInt(this.parseRedisInfo(lines, 'keyspace_misses') || '0');
      
      const total = hits + misses;
      return total > 0 ? hits / total : 0;
    } catch (error) {
      return 0;
    }
  }
}

interface CacheStats {
  localCacheSize: number;
  pendingRequests: number;
  redis: {
    connected: boolean;
    usedMemory?: string | null;
    totalKeys?: number;
    hitRate?: number;
    uptime?: string | null;
  };
}