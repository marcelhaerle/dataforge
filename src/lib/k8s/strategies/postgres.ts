import { V1EnvVar, V1VolumeMount, V1Probe } from '@kubernetes/client-node';
import { DatabaseStrategy, BackupConfig } from './types';
import { generatePassword } from '@/lib/utils';

export class PostgresStrategy implements DatabaseStrategy {
  getDbType(): string {
    return 'postgres';
  }

  getImageName(version: string): string {
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
        valueFrom: { secretKeyRef: { name: secretName, key: 'password' } },
      },
      {
        name: 'POSTGRES_USER',
        valueFrom: { secretKeyRef: { name: secretName, key: 'username' } },
      },
      {
        name: 'POSTGRES_DB',
        valueFrom: { secretKeyRef: { name: secretName, key: 'db_name' } },
      },
      // Fix for Lost+Found folder issues on some storage providers
      {
        name: 'PGDATA',
        value: '/var/lib/postgresql/data/pgdata',
      },
    ];
  }

  createVolumeMounts(): V1VolumeMount[] {
    return [
      {
        name: 'postgres-data',
        mountPath: '/var/lib/postgresql/data',
      },
    ];
  }

  getContainerArgs(): string[] {
    return [];
  }

  getReadinessProbe(): V1Probe {
    return {
      exec: {
        command: ['/bin/sh', '-c', 'pg_isready -h 127.0.0.1 -p 5432'],
      },
      initialDelaySeconds: 5,
      periodSeconds: 10,
      failureThreshold: 3,
    };
  }

  getBackupConfig(name: string, secretName: string, dbName: string, version: string): BackupConfig {
    // Pipeline: pg_dump -> AWS CLI -> S3
    const cmd = [
      '/bin/sh',
      '-c',
      `set -o pipefail && \
      apk add --no-cache aws-cli && \
      export AWS_ACCESS_KEY_ID=$S3_ACCESS_KEY && \
      export AWS_SECRET_ACCESS_KEY=$S3_SECRET_KEY && \
      export AWS_DEFAULT_REGION=$S3_REGION && \
      pg_dump -h ${name}-service -U $DB_USER --clean --if-exists $DB_NAME \
      | aws s3 cp - s3://$S3_BUCKET/${name}/backup_$(date +%Y-%m-%d_%H-%M-%S).sql \
      --endpoint-url $S3_ENDPOINT`,
    ];

    return {
      image: this.getImageName(version),
      command: cmd,
      env: [
        {
          name: 'DB_USER',
          valueFrom: { secretKeyRef: { name: secretName, key: 'username' } },
        },
        {
          name: 'PGPASSWORD',
          valueFrom: { secretKeyRef: { name: secretName, key: 'password' } },
        },
        { name: 'DB_NAME', value: dbName },
      ],
    };
  }

  getInternalDbName(dbName: string): string {
    return dbName.replace(/-/g, '_');
  }

  createUsername(): string {
    return `user_${generatePassword(6)}`;
  }

  createPassword(): string {
    return generatePassword();
  }

  createDumpCommand(): string[] {
    return ['/bin/sh', '-c', `pg_dump -h localhost -U $POSTGRES_USER $POSTGRES_DB`];
  }

  createPreRestoreCommand(): string[] {
    return [
      '/bin/sh',
      '-c',
      'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = current_database();"',
    ];
  }

  createRestoreCommand(): string[] {
    return ['/bin/sh', '-c', 'psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB'];
  }
}
