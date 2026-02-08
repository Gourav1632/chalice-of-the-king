import { redisClient } from '../database/redis';
import logger from '../utils/logger';

/**
 * Cache manager for frequently accessed data
 * Implements caching layer to reduce database load
 */

const CACHE_PREFIX = 'cache:';
const PUBLIC_ROOMS_KEY = `${CACHE_PREFIX}public_rooms`;
const PUBLIC_ROOMS_TTL = 5; // 5 seconds

export class CacheManager {
  /**
   * Get cached public rooms list
   */
  async getPublicRooms(): Promise<any[] | null> {
    try {
      const client = redisClient.getClient();
      const cached = await client.get(PUBLIC_ROOMS_KEY);
      
      if (cached) {
        logger.debug('Public rooms cache hit');
        return JSON.parse(cached);
      }
      
      logger.debug('Public rooms cache miss');
      return null;
    } catch (error) {
      logger.error('Error getting cached public rooms:', error);
      return null;
    }
  }

  /**
   * Cache public rooms list
   */
  async setPublicRooms(rooms: any[]): Promise<void> {
    try {
      const client = redisClient.getClient();
      await client.setEx(
        PUBLIC_ROOMS_KEY,
        PUBLIC_ROOMS_TTL,
        JSON.stringify(rooms)
      );
      logger.debug(`Cached ${rooms.length} public rooms`);
    } catch (error) {
      logger.error('Error caching public rooms:', error);
    }
  }

  /**
   * Invalidate public rooms cache
   * Call this when a room is created, deleted, or changes visibility
   */
  async invalidatePublicRooms(): Promise<void> {
    try {
      const client = redisClient.getClient();
      await client.del(PUBLIC_ROOMS_KEY);
      logger.debug('Invalidated public rooms cache');
    } catch (error) {
      logger.error('Error invalidating public rooms cache:', error);
    }
  }

  /**
   * Generic cache getter with TTL
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = redisClient.getClient();
      const cached = await client.get(`${CACHE_PREFIX}${key}`);
      
      if (cached) {
        return JSON.parse(cached) as T;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting cached value for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Generic cache setter with TTL
   */
  async set<T>(key: string, value: T, ttl: number = 60): Promise<void> {
    try {
      const client = redisClient.getClient();
      await client.setEx(
        `${CACHE_PREFIX}${key}`,
        ttl,
        JSON.stringify(value)
      );
    } catch (error) {
      logger.error(`Error setting cached value for key ${key}:`, error);
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      await client.del(`${CACHE_PREFIX}${key}`);
    } catch (error) {
      logger.error(`Error deleting cached value for key ${key}:`, error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    try {
      const client = redisClient.getClient();
      const keys = await client.keys(`${CACHE_PREFIX}*`);
      
      if (keys.length > 0) {
        await client.del(keys);
        logger.info(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
