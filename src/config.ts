import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  SPARK_API_KEY: z.string().min(1, 'SPARK_API_KEY is required'),
  SPARK_BASE_URL: z.string().url('SPARK_BASE_URL must be a valid URL'),
  PORT: z.string().default('3000'),
  ALLOWED_ORIGINS: z.string().default(''),
});

function loadConfig() {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error('❌ Configuration error — missing or invalid environment variables:');
    console.error(errors);
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

export type Config = typeof config;
