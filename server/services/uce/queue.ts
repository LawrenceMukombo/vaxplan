import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const isRedisConfigured = Boolean(process.env.REDIS_URL?.trim());

export const redisConnection = isRedisConfigured
  ? new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        return Math.min(times * 1000, 10000);
      },
    })
  : {
      async publish() {
        throw new Error('Redis is not configured. Set REDIS_URL to enable Redis messaging.');
      },
    };

let lastErrorTime = 0;
if (isRedisConfigured && 'on' in redisConnection) {
  redisConnection.on('error', (err: any) => {
    const now = Date.now();
    if (now - lastErrorTime > 10000) {
      console.warn(`[Redis] Connection warning: ${err.message || err}`);
      lastErrorTime = now;
    }
  });
}

export const communicationQueue = isRedisConfigured
  ? new Queue('communication-queue', {
      connection: redisConnection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    })
  : {
      async add() {
        throw new Error('Redis is not configured. Set REDIS_URL to enable the communication queue.');
      },
    };

export interface UceJobPayload {
  communicationId: string;
  recipientId: string;
  messageType: string;
  channel: 'whatsapp' | 'sms' | 'push' | 'email' | 'voice';
  templateName: string;
  templateData: Record<string, any>;
  tenantId: string;
}
