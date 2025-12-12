import { z } from 'zod';

const envSchema = z.object({
  // App Config
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NAMESPACE: z.string().default('dataforge-db'),

  // Kubernetes Config
  // Empty for auto-detect (in-cluster) or ~/.kube/config
  KUBECONFIG: z.string().optional(),

  // S3 / MinIO Config (Mandatory!)
  S3_ENDPOINT: z.url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().default('dataforge-backups'),
  S3_REGION: z.string().default('us-east-1'),

  // Security
  PASSWORD_LENGTH: z.coerce.number().default(16),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Invalid environment variables:', z.treeifyError(_env.error));
  throw new Error('Invalid environment variables');
}

export const config = _env.data;
