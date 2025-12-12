import { k8s } from '@/lib/k8s/api';
import { exec } from '@/lib/k8s/client';
import { config } from '@/lib/config';
import { storageService } from '@/lib/storage';
import { StrategyFactory } from '@/lib/k8s/strategies/factory';
import { PassThrough } from 'stream';
import { V1Job } from '@kubernetes/client-node';
import { isK8sError } from '../k8s/errors';

/**
 * Ensures that the global S3 credentials secret exists in the cluster.
 *
 * WHY IS THIS NEEDED?
 * The automated CronJobs (running inside the cluster) cannot access the Next.js .env file.
 * They need a native Kubernetes Secret mapped to environment variables to authenticate with S3/MinIO.
 * This function syncs the local .env config to the cluster state.
 */
export async function ensureGlobalS3Secret() {
  const secretName = 'dataforge-s3-credentials';
  const secretData = {
    'access-key': config.S3_ACCESS_KEY,
    'secret-key': config.S3_SECRET_KEY,
    endpoint: config.S3_ENDPOINT,
    bucket: config.S3_BUCKET,
    region: config.S3_REGION,
  };

  try {
    // Try creating first
    await k8s.createSecret({
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: secretName,
        labels: { 'managed-by': 'dataforge' },
      },
      stringData: secretData,
    });
    console.log(`Created global S3 secret: ${secretName}`);
  } catch (e) {
    if (isK8sError(e) && e.body.code === 409) {
      // Secret already exists -> Update via Patch to ensure latest credentials
      try {
        await k8s.patchSecret(secretName, secretData);
        console.log(`Updated global S3 secret: ${secretName}`);
      } catch (patchError) {
        console.warn(`Failed to patch S3 secret:`, patchError);
      }
    } else {
      console.error(`Failed to ensure S3 secret:`, e);
    }
  }
}

/**
 * Triggers an immediate backup by creating a one-off Job.
 *
 * STRATEGY:
 * Instead of duplicating logic, we clone the PodSpec from the existing CronJob.
 * This ensures the manual backup uses exactly the same image, command, and env vars
 * as the scheduled nightly backup.
 *
 * @param name - Database name
 */
export async function triggerBackup(name: string) {
  const cronJobName = `${name}-backup`;
  const manualJobName = `${name}-manual-backup-${Date.now()}`;

  try {
    await ensureGlobalS3Secret();

    // 1. Fetch template from existing CronJob
    const cronJob = await k8s.getCronJob(cronJobName);

    if (!cronJob.spec?.jobTemplate.spec) {
      throw new Error('CronJob definition invalid');
    }

    // 2. Clone spec into a new Job
    const job: V1Job = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: manualJobName,
        namespace: config.NAMESPACE,
        labels: {
          app: name,
          'managed-by': 'dataforge',
          'dataforge.db/type': 'manual-backup',
        },
      },
      spec: {
        ...cronJob.spec.jobTemplate.spec,
        // Aggressive Cleanup: Delete manual job pod after 5 minutes
        ttlSecondsAfterFinished: 300,
      },
    };

    console.log(`Triggering manual backup for ${name} (Job: ${manualJobName})`);
    await k8s.createJob(job);

    return { jobName: manualJobName };
  } catch (e: unknown) {
    console.error(`Failed to trigger backup for ${name}:`, e);
    throw new Error(
      isK8sError(e) && e.body?.code === 404
        ? 'Backup configuration not found'
        : 'Failed to trigger backup',
    );
  }
}

/**
 * Streams a database dump directly from the running pod to the client.
 *
 * ARCHITECTURE:
 * [Pod: pg_dump] -> (stdout) -> [K8s Exec API] -> [Node.js PassThrough] -> [Client/Browser]
 * * This creates a backpressure-aware stream chain. We never load the full dump
 * into memory, allowing us to handle gigabytes of data with minimal RAM usage.
 */
export async function getDatabaseDumpStream(name: string): Promise<ReadableStream> {
  const podName = `${name}-statefulset-0`;

  // Resolve Strategy to get the correct dump command (e.g. pg_dump vs redis-cli)
  const sts = await k8s.getStatefulSet(`${name}-statefulset`);
  const type = sts.metadata?.labels?.['dataforge.db/type'];

  if (!type) throw new Error('Could not determine database type');

  const strategy = StrategyFactory.getStrategy(type);
  const cmd = strategy.createDumpCommand();
  const passthrough = new PassThrough();

  console.log(`Starting dump stream for ${name}...`);

  // Executes the command inside the container
  await exec.exec(
    config.NAMESPACE,
    podName,
    'database',
    cmd,
    passthrough, // Pipe STDOUT to our stream
    process.stderr,
    null,
    false,
    (status) => {
      if (status.status === 'Failure') {
        console.error('Dump stream failed:', status.message);
        passthrough.end();
      }
    },
  );

  // Convert Node.js Stream to Web Stream (required by Next.js App Router Response)
  return new ReadableStream({
    start(controller) {
      passthrough.on('data', (chunk) => controller.enqueue(chunk));
      passthrough.on('end', () => controller.close());
      passthrough.on('error', (err) => controller.error(err));
    },
  });
}

/**
 * Restores a database from an S3 backup key.
 * CAUTION: This creates a data loss event (overwrites existing data)!
 * FLOW:
 * 1. Download Stream from S3.
 * 2. Terminate active DB connections (Postgres cannot drop tables if users are connected).
 * 3. Pipe S3 Stream into DB Restore Command (e.g., psql) inside the Pod.
 */
export async function restoreDatabase(name: string, backupKey: string) {
  const podName = `${name}-statefulset-0`;

  console.log(`Restoring ${name} from ${backupKey}...`);

  const sts = await k8s.getStatefulSet(`${name}-statefulset`);
  const type = sts.metadata?.labels?.['dataforge.db/type'] || 'postgres';

  const strategy = StrategyFactory.getStrategy(type);
  const backupStream = await storageService.getBackupStream(backupKey);

  // 1. Prepare (Kill connections)
  // Essential for Postgres to allow DROP/CREATE DATABASE operations
  try {
    const killCmd = strategy.createPreRestoreCommand();
    await exec.exec(config.NAMESPACE, podName, 'database', killCmd, null, null, null, false);
  } catch (e) {
    console.warn('Pre-restore command failed (ignoring):', e);
  }

  // 2. Restore Pipeline
  const restoreCmd = strategy.createRestoreCommand();

  return new Promise<void>((resolve, reject) => {
    exec
      .exec(
        config.NAMESPACE,
        podName,
        'database',
        restoreCmd,
        null, // stdout ignored (too verbose)
        process.stderr, // log stderr for errors
        backupStream, // Pipe S3 stream into STDIN of the process
        false,
        (status) => {
          if (status.status === 'Failure') {
            reject(new Error(`Restore execution failed: ${status.message}`));
          } else {
            console.log(`Restore for ${name} completed.`);
            resolve();
          }
        },
      )
      .catch(reject);
  });
}
