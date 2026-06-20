import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Create a singleton Redis connection for queues
export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 1000, 10000);
    return delay;
  }
});

let lastErrorTime = 0;
redisConnection.on('error', (err) => {
  const now = Date.now();
  if (now - lastErrorTime > 10000) {
    console.warn(`[Redis] Connection warning: ${err.message || err}`);
    lastErrorTime = now;
  }
});

// Main queue for processing outbound communications
export const communicationQueue = new Queue('communication-queue', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { age: 24 * 3600 }, // keep for 24 hours
    removeOnFail: { age: 7 * 24 * 3600 }, // keep failures for 7 days
  },
});

export interface UceJobPayload {
  communicationId: string;
  recipientId: string;
  messageType: string;
  channel: 'whatsapp' | 'sms' | 'push' | 'email' | 'voice';
  templateName: string;
  templateData: Record<string, any>;
  tenantId: string;
}
