import { V1EnvVar, V1VolumeMount, V1Probe } from '@kubernetes/client-node';
import { generatePassword } from '../utils';

/**
 * Interface for database strategies.
 * Defines behavior for different DB types (Postgres, Redis, etc.).
 */
export interface DatabaseStrategy {
    /** Returns the internal type name (e.g., 'postgres') */
    getDbType(): string;

    /** Builds the image string (e.g., 'postgres:17-alpine') */
    getImageName(version: string): string;

    /** Returns the default port (internal & external) */
    getDefaultPort(): number;

    /** * Name for the PVC and Volume.
     * Important for polymorphism when deleting! 
     */
    getVolumeName(): string;

    /**
     * Creates environment variables for the container.
     * Secret references for user/password are set here.
     */
    createContainerEnv(secretName: string): V1EnvVar[];

    /** Defines mount points within the container */
    createVolumeMounts(): V1VolumeMount[];

    /** Special start arguments */
    getContainerArgs(): string[];

    /**
     * Health check configuration.
     * Ensures K8s knows when the DB is truly ready.
     */
    getReadinessProbe(): V1Probe;

    /** Config for backup jobs. */
    getBackupConfig(name: string, secretName: string, dbName: string, version: string): {
        image: string;
        command: string[];
        env: V1EnvVar[];
    } | null;

    /**
     * Create the internal database name if needed.
     * @param dbName the requested database name
     * @return the internal database name
     */
    getInternalDbName(dbName: string): string;

    /**
     * Create the username used for DB access.
     */
    createUsername(): string;

    /**
     * Create the password used for DB access.
     */
    createPassword(): string;

    /**
     * Command to create a dump of the database.
     * Used for export functionality.
     */
    createDumpCommand(): string[];
}

/**
 * Implementation for PostgreSQL.
 */
export class PostgresStrategy implements DatabaseStrategy {
    getDbType(): string {
        return 'postgres';
    }

    getImageName(version: string): string {
        // Fallback to '17' if version is empty
        const v = version || '17';
        return `postgres:${v}-alpine`;
    }

    getDefaultPort(): number {
        return 5432;
    }

    getVolumeName(): string {
        return 'postgres-data';
    }

    createContainerEnv(secretName: string): V1EnvVar[] {
        return [
            {
                name: 'POSTGRES_PASSWORD',
                valueFrom: {
                    secretKeyRef: { name: secretName, key: 'password' }
                }
            },
            {
                name: 'POSTGRES_USER',
                valueFrom: {
                    secretKeyRef: { name: secretName, key: 'username' }
                }
            },
            {
                name: 'POSTGRES_DB',
                valueFrom: {
                    secretKeyRef: { name: secretName, key: 'db_name' }
                }
            },
        ];
    }

    createVolumeMounts(): V1VolumeMount[] {
        return [
            {
                name: 'postgres-data',
                mountPath: '/var/lib/postgresql'
            }
        ];
    }

    getContainerArgs(): string[] {
        // Postgres needs no special args in the Alpine image
        return [];
    }

    getReadinessProbe(): V1Probe {
        return {
            exec: {
                // Checks via Unix Socket or TCP Localhost if connections are possible
                command: ['/bin/sh', '-c', 'pg_isready -h 127.0.0.1 -p 5432']
            },
            initialDelaySeconds: 5,
            periodSeconds: 10,
            failureThreshold: 3
        };
    }

    getBackupConfig(name: string, secretName: string, dbName: string, version: string) {
        // Die pg_dump Pipeline -> S3
        const cmd = [
            '/bin/sh',
            '-c',
            `set -o pipefail && \
            apk add --no-cache aws-cli && \
            export AWS_ACCESS_KEY_ID=$S3_ACCESS_KEY && \
            export AWS_SECRET_ACCESS_KEY=$S3_SECRET_KEY && \
            export AWS_DEFAULT_REGION=$S3_REGION && \
            pg_dump -h ${name}-service -U $DB_USER $DB_NAME \
            | aws s3 cp - s3://$S3_BUCKET/$DB_NAME/backup_$(date +%Y-%m-%d_%H-%M-%S).sql \
            --endpoint-url $S3_ENDPOINT`
        ];

        return {
            image: this.getImageName(version),
            command: cmd,
            env: [
                {
                    name: 'DB_USER',
                    valueFrom: { secretKeyRef: { name: secretName, key: 'username' } }
                },
                {
                    name: 'PGPASSWORD',
                    valueFrom: { secretKeyRef: { name: secretName, key: 'password' } }
                },
                { name: 'DB_NAME', value: dbName }
            ]
        };
    }

    getInternalDbName(dbName: string): string {
        // Postgres doesn't like dashes in DB names
        return dbName.replace(/-/g, '_');
    }

    createUsername(): string {
        return `user_${generatePassword(6)}`;
    }

    createPassword(): string {
        return generatePassword();
    }

    createDumpCommand(): string[] {
        return [
            '/bin/sh',
            '-c',
            `pg_dump -h localhost -U $DB_USER $DB_NAME`
        ];
    }
}

export class RedisStrategy implements DatabaseStrategy {
    getDbType(): string { return 'redis'; }

    getImageName(version: string): string {
        const v = version || '7';
        return `redis:${v}-alpine`;
    }

    getDefaultPort(): number { return 6379; }

    getVolumeName(): string { return 'redis-data'; }

    createContainerEnv(secretName: string): V1EnvVar[] {
        return [
            {
                name: 'REDIS_PASSWORD',
                valueFrom: { secretKeyRef: { name: secretName, key: 'password' } }
            }
        ];
    }

    createVolumeMounts(): V1VolumeMount[] {
        return [{ name: 'redis-data', mountPath: '/data' }];
    }

    getContainerArgs(): string[] {
        return [
            'redis-server',
            '--appendonly', 'yes',
            '--requirepass', '$(REDIS_PASSWORD)'
        ];
    }

    getReadinessProbe(): V1Probe {
        return {
            tcpSocket: { port: 6379 },
            initialDelaySeconds: 5, periodSeconds: 5, failureThreshold: 3
        };
    }

    getBackupConfig(name: string, secretName: string, dbName: string) {
        // No backup strategy for Redis yet
        return null;
    }

    getInternalDbName(dbName: string): string {
        return "0"; // Redis uses DB 0 by default
    }

    createUsername(): string {
        return 'default'; // Redis uses 'default' user
    }

    createPassword(): string {
        return generatePassword();
    }

    createDumpCommand(): string[] {
        return [
            '/bin/sh',
            '-c',
            `redis-cli -h localhost -a $REDIS_PASSWORD --rdb -`
        ];
    }
}
