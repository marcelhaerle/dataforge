import * as k8s from '@kubernetes/client-node';
import { DatabaseStrategy } from './strategies/types';

/**
 * Creates the StatefulSet for the database.
 * This is the core workload controller ensuring persistence and stable network identity.
 */
export function createStatefulSetObject(
    name: string,
    secretName: string,
    version: string,
    strategy: DatabaseStrategy
): k8s.V1StatefulSet {
    const labels = {
        'app': name,
        'managed-by': 'dataforge',
        'dataforge.db/type': strategy.getDbType(),
    };

    return {
        apiVersion: 'apps/v1',
        kind: 'StatefulSet',
        metadata: {
            name: `${name}-statefulset`,
            labels: labels,
        },
        spec: {
            selector: {
                matchLabels: { app: name },
            },
            serviceName: `${name}-service`,
            replicas: 1,
            // Template for the Pod
            template: {
                metadata: {
                    labels: labels,
                },
                spec: {
                    containers: [
                        {
                            name: 'database',
                            image: strategy.getImageName(version),
                            ports: [
                                {
                                    containerPort: strategy.getDefaultPort(),
                                    name: 'db-port',
                                },
                            ],
                            env: strategy.createContainerEnv(secretName),
                            volumeMounts: strategy.createVolumeMounts(),
                            args: strategy.getContainerArgs(),
                            readinessProbe: strategy.getReadinessProbe(),
                        },
                    ],
                },
            },
            // Request storage from the cluster (Longhorn)
            volumeClaimTemplates: [
                {
                    metadata: {
                        name: strategy.getVolumeName(),
                    },
                    spec: {
                        accessModes: ['ReadWriteOnce'],
                        storageClassName: 'longhorn',
                        resources: {
                            requests: {
                                storage: '1Gi',
                            },
                        },
                    },
                },
            ],
        },
    };
}

/**
 * Creates the Service to expose the database.
 * We use LoadBalancer to get a dedicated IP (via MetalLB) for each DB.
 */
export function createServiceObject(
    name: string,
    strategy: DatabaseStrategy
): k8s.V1Service {
    return {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
            name: `${name}-service`,
            labels: {
                'app': name,
                'managed-by': 'dataforge',
            },
        },
        spec: {
            type: 'LoadBalancer',
            selector: { app: name },
            ports: [
                {
                    name: 'db-port',
                    port: strategy.getDefaultPort(),
                    targetPort: strategy.getDefaultPort(),
                },
            ],
        },
    };
}

/**
 * Creates the Secret containing credentials and metadata.
 * Note: We use stringData for convenience, K8s client handles base64 encoding.
 */
export function createCredentialsSecretObject(
    name: string,
    credentials: { username: string; password: string; dbName: string; version: string, backupSchedule: string }
): k8s.V1Secret {
    return {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
            name: name,
            labels: {
                'managed-by': 'dataforge',
            },
        },
        type: 'Opaque',
        stringData: {
            username: credentials.username,
            password: credentials.password,
            db_name: credentials.dbName,
            version: credentials.version,
            backup_schedule: credentials.backupSchedule,
        },
    };
}

/**
 * Creates a CronJob for automated S3 backups.
 */
export function createBackupCronJobObject(
    name: string,
    schedule: string,
    dbSecretName: string,
    dbName: string,
    dbVersion: string,
    strategy: DatabaseStrategy
): k8s.V1CronJob | null {
    const backupConfig = strategy.getBackupConfig(name, dbSecretName, dbName, dbVersion);

    if (!backupConfig) {
        return null;
    }

    const jobName = `${name}-backup`;

    return {
        apiVersion: 'batch/v1',
        kind: 'CronJob',
        metadata: {
            name: jobName,
            labels: {
                'app': name,
                'managed-by': 'dataforge',
                'dataforge.db/type': 'backup',
            },
        },
        spec: {
            schedule: schedule,
            jobTemplate: {
                spec: {
                    ttlSecondsAfterFinished: 3600, // Clean up finished pods after 1h
                    template: {
                        spec: {
                            restartPolicy: 'OnFailure',
                            containers: [
                                {
                                    name: 'backup-worker',
                                    image: backupConfig.image,
                                    command: backupConfig.command,
                                    env: [
                                        ...backupConfig.env,
                                        // --- S3 Credentials (Global Secret) ---
                                        {
                                            name: 'S3_ACCESS_KEY',
                                            valueFrom: {
                                                secretKeyRef: { name: 'dataforge-s3-credentials', key: 'access-key' },
                                            },
                                        },
                                        {
                                            name: 'S3_SECRET_KEY',
                                            valueFrom: {
                                                secretKeyRef: { name: 'dataforge-s3-credentials', key: 'secret-key' },
                                            },
                                        },
                                        {
                                            name: 'S3_ENDPOINT',
                                            valueFrom: {
                                                secretKeyRef: { name: 'dataforge-s3-credentials', key: 'endpoint' },
                                            },
                                        },
                                        {
                                            name: 'S3_BUCKET',
                                            valueFrom: {
                                                secretKeyRef: { name: 'dataforge-s3-credentials', key: 'bucket' },
                                            },
                                        },
                                        {
                                            name: 'S3_REGION',
                                            valueFrom: {
                                                secretKeyRef: { name: 'dataforge-s3-credentials', key: 'region' },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
            },
        },
    };
}
