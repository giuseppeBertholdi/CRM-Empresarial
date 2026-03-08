import { Queue } from "bullmq";
import { env } from "@/lib/env";

export type ReminderJobData = {
  reminderLogId: string;
  conversationId: string;
  ruleId: string;
};

type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
};

function parseRedisUrl(redisUrl: string): RedisConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || "6379"),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

let redisConnection: RedisConnectionOptions | null = null;

if (env.REDIS_URL) {
  redisConnection = parseRedisUrl(env.REDIS_URL);
}

export const remindersQueue = redisConnection
  ? new Queue<ReminderJobData>("reminders", {
      connection: redisConnection,
    })
  : null;

export function isQueueEnabled() {
  return Boolean(remindersQueue);
}

export function getQueueConnection() {
  return redisConnection;
}
