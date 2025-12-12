import { k8s } from '@/lib/k8s/api';
import * as builders from '@/lib/k8s/builder';
import { StrategyFactory } from '@/lib/k8s/strategies/factory';
import { storageService } from '@/lib/storage';
import { ensureGlobalS3Secret } from './backup';
import { isK8sError } from '../k8s/errors';

export interface CreateDatabaseRequest {
  name: string;
  type: 'postgres' | 'redis';
  version: string;
  dbName?: string;
  backupSchedule?: string;
}

export interface DatabaseInstance {
  name: string;
  type: 'postgres' | 'redis';
  status: 'Pending' | 'Running';
  username: string;
  password: string;
  internalDbName: string;
  ip?: string;
  port?: number;
  backupSchedule?: string;
}

/**
 * Orchestrates the creation of a new database instance.
 *
 * This function acts as a transaction: It creates multiple dependent Kubernetes resources
 * (Secret, Service, StatefulSet, CronJob). If any step fails, it triggers a rollback
 * to clean up partially created resources.
 *
 * @param req - The user request containing name, type, and settings.
 * @returns The created database instance status (usually 'Pending').
 * @throws Error if the database already exists or creation fails.
 */
export async function createDatabase(req: CreateDatabaseRequest): Promise<DatabaseInstance> {
  console.log(`Creating database ${req.name} (${req.type})...`);

  // 1. Prepare Strategy & Credentials
  // We use the Strategy Factory to abstract away DB-specific logic (e.g. Redis vs Postgres).
  const strategy = StrategyFactory.getStrategy(req.type);
  const password = strategy.createPassword();
  const username = strategy.createUsername();
  const internalDbName = strategy.getInternalDbName(req.dbName || req.name);
  const secretName = `${req.name}-secret`;

  try {
    // 0. Ensure Global Dependencies
    // The backup CronJob relies on a global secret containing S3 credentials.
    // We ensure it exists before creating resources that depend on it.
    await ensureGlobalS3Secret();

    // 1. Create Secrets (Credentials)
    // Must be created first so they can be mounted as env vars in the StatefulSet.
    const secretObj = builders.createCredentialsSecretObject(secretName, {
      username,
      password,
      dbName: internalDbName,
      version: req.version,
      backupSchedule: req.backupSchedule || '0 3 * * *',
    });
    await k8s.createSecret(secretObj);

    // 2. Create Service (Networking)
    // Creates a LoadBalancer to assign a dedicated IP (via MetalLB) to this DB.
    const serviceObj = builders.createServiceObject(req.name, strategy);
    await k8s.createService(serviceObj);

    // 3. Create Workload (StatefulSet)
    // The core database pod. We pass the secret name so it can inject credentials.
    const stsObj = builders.createStatefulSetObject(req.name, secretName, req.version, strategy);
    await k8s.createStatefulSet(stsObj);

    // 4. Create Backup Job (Data Protection)
    // Only created if the strategy supports backups (returns a config).
    const schedule = req.backupSchedule || '0 3 * * *';
    const cronObj = builders.createBackupCronJobObject(
      req.name,
      schedule,
      secretName,
      internalDbName,
      req.version,
      strategy,
    );

    if (cronObj) {
      console.log(`Scheduling Backup Job for ${req.name}`);
      await k8s.createCronJob(cronObj);
    }

    return {
      name: req.name,
      type: req.type,
      status: 'Pending',
      username,
      password,
      internalDbName,
      backupSchedule: schedule,
    };
  } catch (err) {
    // Handle "Already Exists" gracefully
    if (isK8sError(err) && err.body.code === 409) {
      throw new Error('Database already exists');
    }
    // Critical Failure: Clean up mess
    await rollbackCreation(req.name, secretName);
    throw err;
  }
}

/**
 * Deletes a database and all associated resources.
 *
 * This includes:
 * 1. Kubernetes Resources (StatefulSet, Service, Secret, CronJob)
 * 2. Storage (PersistentVolumeClaim) - MUST be deleted manually as STS doesn't own it.
 * 3. Backups (S3 Object Storage) - Cleans up the folder in the bucket.
 *
 * @param name - The name of the database service to delete.
 */
export async function deleteDatabase(name: string) {
  try {
    // 1. Introspection
    // We need to know the type (Redis/Postgres) to calculate the correct PVC name.
    const sts = await k8s.getStatefulSet(`${name}-statefulset`);
    const type = sts.metadata?.labels?.['dataforge.db/type'] || 'postgres';
    const strategy = StrategyFactory.getStrategy(type);

    // Pattern: <volume-name>-<pod-name>-<ordinal> (e.g. postgres-data-mydb-0)
    const pvcName = `${strategy.getVolumeName()}-${name}-statefulset-0`;

    // Try to recover internal DB name from secret before deleting it (for S3 cleanup)
    let internalDbName = '';
    try {
      const secret = await k8s.getSecret(`${name}-secret`);
      if (secret.data?.db_name) {
        internalDbName = Buffer.from(secret.data.db_name, 'base64').toString();
      }
    } catch {}

    // 2. Delete Kubernetes Resources
    // We delete the StatefulSet first to stop pods writing to the volume.
    await k8s.deleteStatefulSet(`${name}-statefulset`);
    await k8s.deleteService(`${name}-service`);
    await k8s.deleteSecret(`${name}-secret`);
    await k8s.deleteCronJob(`${name}-backup`);

    // 3. Delete Storage (PVC)
    // StatefulSets do NOT delete their PVCs automatically to prevent data loss.
    // Since this is an explicit "Delete DB" action, we must clean it up manually.
    console.log(`Deleting PVC ${pvcName}...`);
    await k8s
      .deletePVC(pvcName)
      .catch((e) => console.warn(`PVC delete failed: ${e.body?.message}`));

    // 4. Delete Offsite Backups (S3)
    if (internalDbName) {
      storageService.deleteBackupsFolder(internalDbName).catch(console.error);
    }
  } catch (e) {
    if (isK8sError(e) && e.body?.code === 404) throw new Error('Database not found');
    throw e;
  }
}

/**
 * Lists all managed databases by querying Kubernetes.
 *
 * Aggregates data from multiple sources:
 * - StatefulSet: Status (Running/Pending) and Type labels.
 * - Secret: Credentials (Username/Password).
 * - Service: Networking (External IP/Port).
 *
 * @returns A list of enriched DatabaseInstance objects.
 */
export async function listDatabases(): Promise<DatabaseInstance[]> {
  try {
    // Filter: Only list resources managed by this application
    const stsList = await k8s.listStatefulSets('managed-by=dataforge');
    const databases: DatabaseInstance[] = [];

    for (const sts of stsList.items) {
      const name = sts.metadata?.labels?.app || 'unknown';
      const type = sts.metadata?.labels?.['dataforge.db/type'] as 'postgres' | 'redis';

      // Ready Logic: A DB is ready when the number of ready replicas matches desired replicas.
      const isReady = (sts.status?.readyReplicas || 0) === (sts.status?.replicas || 1);

      // Default values in case fetching details fails (e.g. during deletion)
      const info = {
        username: '',
        password: '',
        dbName: '',
        ip: undefined as string | undefined,
        port: undefined as number | undefined,
      };
      let backupSchedule = '';

      try {
        // Fetch Credentials
        const secret = await k8s.getSecret(`${name}-secret`);
        const data = secret.data || {};
        info.username = Buffer.from(data.username || '', 'base64').toString();
        info.password = Buffer.from(data.password || '', 'base64').toString();
        info.dbName = Buffer.from(data.db_name || '', 'base64').toString();
        backupSchedule = Buffer.from(data.backup_schedule || '', 'base64').toString();

        // Fetch Networking
        const svc = await k8s.getService(`${name}-service`);
        const ingress = svc?.status?.loadBalancer?.ingress;
        if (ingress && ingress.length > 0) {
          info.ip = ingress[0].ip;
          info.port = svc?.spec?.ports?.[0].port;
        }
      } catch {
        // Ignore errors (resource might be terminating)
      }

      databases.push({
        name,
        type,
        status: isReady ? 'Running' : 'Pending',
        username: info.username,
        password: info.password,
        internalDbName: info.dbName,
        ip: info.ip,
        port: info.port,
        backupSchedule,
      });
    }
    return databases;
  } catch (e) {
    console.error('List Error:', e);
    throw new Error('Failed to list databases');
  }
}

/**
 * Helper to fetch a single database details.
 */
export async function getDatabaseDetails(name: string) {
  const list = await listDatabases();
  const found = list.find((d) => d.name === name);
  if (!found) throw new Error('Database not found');
  return found;
}

/**
 * Internal helper to clean up resources if creation fails.
 * Attempts to delete all potential resources created during `createDatabase`.
 */
async function rollbackCreation(name: string, secretName: string) {
  console.log(`Rolling back ${name}...`);
  await k8s.deleteSecret(secretName);
  await k8s.deleteService(`${name}-service`);
  await k8s.deleteStatefulSet(`${name}-statefulset`);
  await k8s.deleteCronJob(`${name}-backup`);
}
