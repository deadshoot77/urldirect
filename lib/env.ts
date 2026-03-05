import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  DEFAULT_REDIRECT_URL: z.string().url("DEFAULT_REDIRECT_URL must be a valid URL"),
  DEFAULT_REDIRECT_STATUS: z
    .string()
    .default("302")
    .transform((value) => Number(value))
    .pipe(z.union([z.literal(301), z.literal(302)])),
  ADMIN_PASSWORD: z.string().min(10, "ADMIN_PASSWORD must be at least 10 chars"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  TRACKING_TOKEN_SECRET: z.string().min(16, "TRACKING_TOKEN_SECRET must be at least 16 chars").optional(),
  IP_HASH_SALT: z.string().min(16, "IP_HASH_SALT must be at least 16 chars"),
  COUNT_HEAD_VISITS: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
  TRACKING_ENABLED_DEFAULT: z
    .enum(["true", "false"])
    .optional()
    .default("true")
    .transform((value) => value === "true"),
  TRACKING_LIMIT_BEHAVIOR: z.enum(["drop", "minimal"]).optional().default("drop")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment variables: ${issues}`);
}

export const env = parsed.data;
