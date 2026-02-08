import { z } from "zod";
import logger from "../utils/logger";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("3001").pipe(z.string().regex(/^\d+$/).transform(Number)),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  RATE_LIMIT_WINDOW_MS: z.string().default("1000").pipe(z.string().regex(/^\d+$/).transform(Number)),
  RATE_LIMIT_MAX_REQUESTS: z.string().default("5").pipe(z.string().regex(/^\d+$/).transform(Number)),
  // WebRTC SFU Configuration
  SFU_PROVIDER: z.enum(["mock", "livekit", "mediasoup"]).default("mock"),
  SFU_ROOM_TTL: z.string().default("0").pipe(z.string().regex(/^\d+$/).transform(Number)),
  // LiveKit Configuration (if using LiveKit provider)
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    logger.error("❌ Environment validation failed:");
    parsed.error.issues.forEach((issue) => {
      logger.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  env = parsed.data;
  logger.info("✅ Environment variables validated successfully");
  return env;
}

export function getEnv(): Env {
  if (!env) {
    throw new Error("Environment not validated. Call validateEnv() first.");
  }
  return env;
}

// Export env for convenience (call validateEnv() first in index.ts)
export { env };
