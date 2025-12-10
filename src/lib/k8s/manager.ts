import {
    appsV1Api,
    coreV1Api,
    batchV1Api
} from './client';
import * as builders from './builder';
import { PostgresStrategy, DatabaseStrategy } from './strategies';
import { config } from '@/lib/config';
import crypto from 'crypto';

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
    status: 'Running' | 'Pending' | 'Error';
    username?: string;
    password?: string;
    internalDbName?: string;
    ip?: string;
    port?: number;
}

/**
 * Helper to generate secure random passwords.
 */
function generatePassword(length = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(crypto.randomFillSync(new Uint8Array(length)))
        .map((x) => charset[x % charset.length])
        .join('');
}

/**
 * Factory to get the correct strategy.
 * For now, we only support Postgres in this port.
 */
function getStrategy(type: string): DatabaseStrategy {
    if (type === 'postgres') {
        return new PostgresStrategy();
    }
    // Redis can be added here later
    throw new Error(`Unknown database type: ${type}`);
}

/**
 * Rolls back resources if creation fails midway.
 */
async function rollbackCreation(name: string, secretName: string) {
    console.log(`Rolling back resources for ${name}...`);
    try {
        // Delete Secret
        await coreV1Api.deleteNamespacedSecret({ name: secretName, namespace: config.NAMESPACE });
        // Delete Service
        await coreV1Api.deleteNamespacedService({ name: `${name}-service`, namespace: config.NAMESPACE, });
        // Delete StatefulSet
        await appsV1Api.deleteNamespacedStatefulSet({ name: `${name}-statefulset`, namespace: config.NAMESPACE });
        // Delete CronJob (if exists)
        await batchV1Api.deleteNamespacedCronJob({ name: `${name}-backup`, namespace: config.NAMESPACE }).catch(() => { });
    } catch (e) {
        console.error(`Rollback failed for ${name}:`, e);
    }
}

/**
 * Orchestrates the creation of a database.
 */
export async function createDatabase(req: CreateDatabaseRequest) {
    console.log(`Creating database ${req.name} (${req.type})...`);

    const strategy = getStrategy(req.type);
    const password = generatePassword();
    const username = `user_${generatePassword(6)}`;
    // Normalize DB name (Postgres doesn't like dashes in SQL names)
    const internalDbName = req.dbName || req.name.replace(/-/g, '_');
    const secretName = `${req.name}-secret`;

    try {
        // 1. Create Secret
        const secretObj = builders.createCredentialsSecretObject(secretName, {
            username,
            password,
            dbName: internalDbName,
            version: req.version,
            backupSchedule: req.backupSchedule || '0 3 * * *' // Default 3 AM
        });
        await coreV1Api.createNamespacedSecret({ namespace: config.NAMESPACE, body: secretObj });

        // 2. Create Service
        const serviceObj = builders.createServiceObject(req.name, strategy);
        await coreV1Api.createNamespacedService({ namespace: config.NAMESPACE, body: serviceObj });

        // 3. Create StatefulSet
        const stsObj = builders.createStatefulSetObject(req.name, secretName, req.version, strategy);
        await appsV1Api.createNamespacedStatefulSet({ namespace: config.NAMESPACE, body: stsObj });

        // 4. Create Backup CronJob (Only for Postgres currently)
        if (req.type === 'postgres') {
            const schedule = req.backupSchedule || '0 3 * * *'; // Default 3 AM
            const cronObj = builders.createBackupCronJobObject(
                req.name,
                schedule,
                secretName,
                internalDbName,
                req.version
            );
            await batchV1Api.createNamespacedCronJob({ namespace: config.NAMESPACE, body: cronObj });
        }

        return { status: 'success', name: req.name };

    } catch (err: any) {
        // Check for K8s Conflict (409)
        if (err.body && err.body.code === 409) {
            throw new Error('Database already exists');
        }

        // Trigger rollback
        await rollbackCreation(req.name, secretName);
        throw err; // Re-throw to be handled by API route
    }
}

/**
 * Lists all managed databases with their details and status.
 */
export async function listDatabases(): Promise<DatabaseInstance[]> {
    try {
        // Fetch all StatefulSets managed by DataForge
        const stsList = await appsV1Api.listNamespacedStatefulSet({
            namespace: config.NAMESPACE,
            labelSelector: 'managed-by=dataforge'
        }
        );

        const databases: DatabaseInstance[] = [];

        for (const sts of stsList.items) {
            const name = sts.metadata?.labels?.app || 'unknown';
            const type = (sts.metadata?.labels?.['dataforge.db/type'] || 'postgres') as 'postgres' | 'redis';

            // Basic Status Check
            const readyReplicas = sts.status?.readyReplicas || 0;
            const replicas = sts.status?.replicas || 1;
            const isReady = readyReplicas === replicas;

            let connectionInfo = {
                username: '',
                password: '',
                dbName: '',
                ip: undefined as string | undefined,
                port: undefined as number | undefined
            };

            try {
                // Fetch Secret to get credentials
                const secret = await coreV1Api.readNamespacedSecret({ name: `${name}-secret`, namespace: config.NAMESPACE });
                const data = secret.data || {};

                // K8s returns Base64, we must decode it
                connectionInfo.username = Buffer.from(data.username || '', 'base64').toString();
                connectionInfo.password = Buffer.from(data.password || '', 'base64').toString();
                connectionInfo.dbName = Buffer.from(data.db_name || '', 'base64').toString();

                // Fetch Service to get IP
                const svc = await coreV1Api.readNamespacedService({ name: `${name}-service`, namespace: config.NAMESPACE });
                const ingress = svc.status?.loadBalancer?.ingress;

                if (ingress && ingress.length > 0) {
                    connectionInfo.ip = ingress[0].ip;
                    connectionInfo.port = svc.spec?.ports?.[0].port;
                }

            } catch (e) {
                console.warn(`Could not fetch details for ${name}, maybe deleting?`);
            }

            databases.push({
                name,
                type,
                status: isReady ? 'Running' : 'Pending',
                username: connectionInfo.username,
                password: connectionInfo.password, // Be careful exposing this!
                internalDbName: connectionInfo.dbName,
                ip: connectionInfo.ip,
                port: connectionInfo.port
            });
        }

        return databases;
    } catch (e) {
        console.error('Error listing databases:', e);
        throw new Error('Failed to list databases');
    }
}

/**
 * Deletes a database and all associated resources (including PVCs).
 */
export async function deleteDatabase(name: string) {
    try {
        // 1. Get STS to verify type and existence
        const sts = await appsV1Api.readNamespacedStatefulSet({ name: `${name}-statefulset`, namespace: config.NAMESPACE });
        const type = sts.metadata?.labels?.['dataforge.db/type'] || 'postgres';

        const strategy = getStrategy(type);
        const pvcName = `${strategy.getVolumeName()}-${name}-statefulset-0`;

        // 2. Delete Resources
        // PropagationPolicy 'Foreground' ensures pods are killed before STS is deleted
        await appsV1Api.deleteNamespacedStatefulSet({
            name: `${name}-statefulset`,
            namespace: config.NAMESPACE,
            body: { propagationPolicy: 'Foreground' }
        }
        );

        await coreV1Api.deleteNamespacedService({ name: `${name}-service`, namespace: config.NAMESPACE });
        await coreV1Api.deleteNamespacedSecret({ name: `${name}-secret`, namespace: config.NAMESPACE });

        // Delete Backup Job
        await batchV1Api.deleteNamespacedCronJob({ name: `${name}-backup`, namespace: config.NAMESPACE }).catch(() => {
            // Ignore if not found (e.g. Redis)
        });

        // 3. Delete PVC (Crucial!)
        console.log(`Deleting PVC ${pvcName}...`);
        await coreV1Api.deleteNamespacedPersistentVolumeClaim({ name: pvcName, namespace: config.NAMESPACE }).catch(err => {
            console.warn(`PVC ${pvcName} could not be deleted (maybe already gone):`, err.body?.message);
        });

    } catch (e: any) {
        if (e.body?.code === 404) {
            throw new Error('Database not found');
        }
        throw e;
    }
}
