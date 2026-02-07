import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';
import { env } from '../config/env';

class RedisClient {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_INTERVAL = 3000; // 3 seconds

  async connect(): Promise<void> {
    try {
      // Create Redis client
      this.client = createClient({
        url: env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries >= this.MAX_RECONNECT_ATTEMPTS) {
              logger.error(`Redis: Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached`);
              return new Error('Max reconnection attempts reached');
            }
            const delay = Math.min(retries * 1000, this.RECONNECT_INTERVAL);
            logger.info(`Redis: Reconnecting in ${delay}ms (attempt ${retries + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
            return delay;
          },
        },
      });

      // Event handlers
      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis: Connection established');
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        logger.info('Redis: Client ready');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        logger.warn(`Redis: Reconnecting (attempt ${this.reconnectAttempts})`);
      });

      this.client.on('end', () => {
        logger.info('Redis: Connection closed');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();
      logger.info('Redis: Successfully connected');
    } catch (error) {
      logger.error('Redis: Failed to connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('Redis: Disconnected gracefully');
      } catch (error) {
        logger.error('Redis: Error during disconnect', error);
        // Force close if graceful quit fails
        await this.client.disconnect();
      }
    }
  }

  getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  async healthCheck(): Promise<{ status: string; latency: number }> {
    try {
      const start = Date.now();
      await this.client?.ping();
      const latency = Date.now() - start;
      
      return {
        status: this.isConnected ? 'healthy' : 'disconnected',
        latency,
      };
    } catch (error) {
      logger.error('Redis health check failed', error);
      return {
        status: 'error',
        latency: -1,
      };
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }
}

// Export singleton instance
export const redisClient = new RedisClient();
