import { V1EnvVar, V1VolumeMount, V1Probe } from '@kubernetes/client-node';
import { DatabaseStrategy, BackupConfig } from './types';
import { generatePassword } from '@/lib/utils';

export class RedisStrategy implements DatabaseStrategy {
  getDbType(): string {
    return 'redis';
  }

  getImageName(version: string): string {
    const v = version || '7';
    return `redis:${v}-alpine`;
  }

  getDefaultPort(): number {
    return 6379;
  }

  getVolumeName(): string {
    return 'redis-data';
  }

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
      initialDelaySeconds: 5,
      periodSeconds: 5,
      failureThreshold: 3
    };
  }

  getBackupConfig(name: string, secretName: string, dbName: string, version: string): BackupConfig | null {
    // Redis backup logic not yet implemented
    return null;
  }

  getInternalDbName(dbName: string): string {
    return "0";
  }

  createUsername(): string {
    return 'default';
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

  createPreRestoreCommand(): string[] {
    return [
      '/bin/sh',
      '-c',
      'redis-cli -h localhost -a $REDIS_PASSWORD FLUSHALL'
    ];
  }

  createRestoreCommand(): string[] {
    return [
      '/bin/sh',
      '-c',
      'redis-cli -h localhost -a $REDIS_PASSWORD --pipe'
    ];
  }
}
