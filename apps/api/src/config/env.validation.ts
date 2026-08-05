import { z } from 'zod';

// Validação forte das variáveis de ambiente no boot — a API não sobe com config inválida.
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET muito curto'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET muito curto'),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),

  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
  SUPER_ADMIN_NAME: z.string().optional(),

  // Criptografia AES-256-GCM das credenciais SMTP em repouso.
  // Aceita chave em hex (64 chars) ou base64 (44 chars) equivalente a 32 bytes.
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY deve ter 32 bytes (hex ou base64)'),

  // Agendador de envio (outbox). Intervalo de varredura e tentativas máximas.
  MAIL_SCHEDULER_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  MAIL_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  MAIL_BATCH_SIZE: z.coerce.number().int().positive().default(25),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  return parsed.data;
}
