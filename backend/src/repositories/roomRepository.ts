import { redisClient } from '../database/redis';
import { RoomData, PublicRoomData } from '../../../shared/types/types';
import logger from '../utils/logger';
import { cacheManager } from '../cache/roomCache';

/**
 * Redis Room Repository
 * Manages room data persistence in Redis with TTL and caching
 */
class RoomRepository {
  private readonly ROOM_PREFIX = 'room:';
  private readonly PUBLIC_ROOMS_SET = 'public_rooms';
  private readonly ROOM_TTL = 7200; // 2 hours in seconds

  /**
   * Generate Redis key for a room
   */
  private getRoomKey(roomId: string): string {
    return `${this.ROOM_PREFIX}${roomId}`;
  }

  /**
   * Save room data to Redis with TTL
   */
  async saveRoom(roomId: string, roomData: RoomData): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = this.getRoomKey(roomId);
      
      // Store room data as JSON
      await client.set(key, JSON.stringify(roomData), {
        EX: this.ROOM_TTL, // Set expiration
      });

      // If room is public, add to public rooms set
      if (!roomData.isPrivate) {
        await client.sAdd(this.PUBLIC_ROOMS_SET, roomId);
        // Invalidate cache when room visibility changes
        await cacheManager.invalidatePublicRooms();
      }

      logger.debug(`Room saved to Redis: ${roomId}`);
    } catch (error) {
      logger.error(`Failed to save room ${roomId} to Redis:`, error);
      throw error;
    }
  }

  /**
   * Get room data from Redis
   */
  async getRoom(roomId: string): Promise<RoomData | null> {
    try {
      const client = redisClient.getClient();
      const key = this.getRoomKey(roomId);
      
      const data = await client.get(key);
      
      if (!data) {
        logger.debug(`Room not found in Redis: ${roomId}`);
        return null;
      }

      // Refresh TTL on access
      await client.expire(key, this.ROOM_TTL);

      const roomData = JSON.parse(data) as RoomData;
      logger.debug(`Room retrieved from Redis: ${roomId}`);
      return roomData;
    } catch (error) {
      logger.error(`Failed to get room ${roomId} from Redis:`, error);
      throw error;
    }
  }

  /**
   * Delete room from Redis
   */
  async deleteRoom(roomId: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const key = this.getRoomKey(roomId);
      
      // Remove from Redis
      const deleted = await client.del(key);
      
      // Remove from public rooms set
      await client.sRem(this.PUBLIC_ROOMS_SET, roomId);
      
      // Invalidate cache when room is deleted
      await cacheManager.invalidatePublicRooms();

      if (deleted > 0) {
        logger.debug(`Room deleted from Redis: ${roomId}`);
        return true;
      }
      
      logger.debug(`Room not found for deletion: ${roomId}`);
      return false;
    } catch (error) {
      logger.error(`Failed to delete room ${roomId} from Redis:`, error);
      throw error;
    }
  }

  /**
   * Check if room exists
   */
  async roomExists(roomId: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const key = this.getRoomKey(roomId);
      const exists = await client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Failed to check if room ${roomId} exists:`, error);
      throw error;
    }
  }

  /**
   * Get all public rooms (with caching)
   */
  async getPublicRooms(): Promise<PublicRoomData[]> {
    try {
      // Try to get from cache first
      const cached = await cacheManager.getPublicRooms();
      if (cached) {
        return cached;
      }

      const client = redisClient.getClient();
      
      // Get all public room IDs
      const roomIds = await client.sMembers(this.PUBLIC_ROOMS_SET);
      
      if (roomIds.length === 0) {
        return [];
      }

      // Fetch all public rooms
      const publicRooms: PublicRoomData[] = [];
      
      for (const roomId of roomIds) {
        const roomData = await this.getRoom(roomId);
        
        if (roomData) {
          // Convert to PublicRoomData
          publicRooms.push({
            id: roomData.id,
            host: roomData.host,
            playersActive: roomData.players.length,
            maxPlayers: roomData.maxPlayers,
            voiceChatEnabled: roomData.voiceChatEnabled,
          });
        } else {
          // Room expired or doesn't exist, remove from set
          await client.sRem(this.PUBLIC_ROOMS_SET, roomId);
        }
      }

      logger.debug(`Retrieved ${publicRooms.length} public rooms from Redis`);
      
      // Cache the result
      await cacheManager.setPublicRooms(publicRooms);
      
      return publicRooms;
    } catch (error) {
      logger.error('Failed to get public rooms from Redis:', error);
      throw error;
    }
  }

  /**
   * Update room privacy status
   */
  async updateRoomPrivacy(roomId: string, isPrivate: boolean): Promise<void> {
    try {
      const client = redisClient.getClient();
      
      if (isPrivate) {
        // Remove from public rooms set
        await client.sRem(this.PUBLIC_ROOMS_SET, roomId);
      } else {
        // Add to public rooms set
        await client.sAdd(this.PUBLIC_ROOMS_SET, roomId);
      }

      logger.debug(`Room ${roomId} privacy updated: ${isPrivate ? 'private' : 'public'}`);
    } catch (error) {
      logger.error(`Failed to update room ${roomId} privacy:`, error);
      throw error;
    }
  }

  /**
   * Get all room IDs
   */
  async getAllRoomIds(): Promise<string[]> {
    try {
      const client = redisClient.getClient();
      
      // Scan for all room keys
      const roomIds: string[] = [];
      let cursor = '0';

      do {
        const result = await client.scan(cursor, {
          MATCH: `${this.ROOM_PREFIX}*`,
          COUNT: 100,
        });

        cursor = result.cursor;
        
        // Extract room IDs from keys
        const keys = result.keys;
        for (const key of keys) {
          const roomId = key.replace(this.ROOM_PREFIX, '');
          roomIds.push(roomId);
        }
      } while (cursor !== '0');

      logger.debug(`Found ${roomIds.length} rooms in Redis`);
      return roomIds;
    } catch (error) {
      logger.error('Failed to get all room IDs from Redis:', error);
      throw error;
    }
  }

  /**
   * Refresh room TTL (extend expiration)
   */
  async refreshRoomTTL(roomId: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = this.getRoomKey(roomId);
      await client.expire(key, this.ROOM_TTL);
      logger.debug(`Room TTL refreshed: ${roomId}`);
    } catch (error) {
      logger.error(`Failed to refresh room ${roomId} TTL:`, error);
      throw error;
    }
  }

  /**
   * Get room count
   */
  async getRoomCount(): Promise<number> {
    try {
      const roomIds = await this.getAllRoomIds();
      return roomIds.length;
    } catch (error) {
      logger.error('Failed to get room count:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const roomRepository = new RoomRepository();
