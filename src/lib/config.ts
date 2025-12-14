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

const isBuildPhase =
  process.env.SKIP_ENV_VALIDATION === 'true' || process.env.NEXT_PHASE === 'phase-production-build';

let parsedConfig;

if (isBuildPhase) {
  // Mock config for the build phase to prevent import crashes
  console.log('Skipping env validation during build phase');
  parsedConfig = {
    NODE_ENV: 'production',
    NAMESPACE: 'mock-ns',
    S3_ENDPOINT: 'http://localhost',
    S3_ACCESS_KEY: 'mock',
    S3_SECRET_KEY: 'mock',
    S3_BUCKET: 'mock',
    S3_REGION: 'mock',
    PASSWORD_LENGTH: 16,
  };
} else {
  // Real validation at runtime
  const _env = envSchema.safeParse(process.env);

  if (!_env.success) {
    console.error('Invalid environment variables:', z.treeifyError(_env.error));
    throw new Error('Invalid environment variables');
  }

  parsedConfig = _env.data;
}

export const config = parsedConfig as z.infer<typeof envSchema>;
