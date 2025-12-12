import { V1EnvVar, V1VolumeMount, V1Probe } from '@kubernetes/client-node';

/**
 * Configuration object required to create a Kubernetes Backup CronJob.
 */
export interface BackupConfig {
  /** The Docker image to use for the backup worker (e.g. 'postgres:17-alpine') */
  image: string;
  /** The shell command to execute the backup and pipe it to S3 */
  command: string[];
  /** Environment variables required by the backup command */
  env: V1EnvVar[];
}

/**
 * Core interface for Database Strategies.
 * Any new database type added to DataForge must implement this interface.
 * It encapsulates all database-specific logic, decoupling the Kubernetes
 * orchestration (Manager/Builder) from the specific database technology.
 */
export interface DatabaseStrategy {
  /** 
   * Returns the unique internal type name (e.g., 'postgres', 'redis', 'mysql').
   * This is used as a key in the factory and for labeling resources.
   */
  getDbType(): string;

  /**
   * Returns the Docker image string for the requested version.
   * 
   * @param version - The version string requested by the user (e.g. "17")
   */
  getImageName(version: string): string;

  /** 
   * Returns the default port the database listens on (e.g. 5432).
   * This will be used for both the container port and the Service port.
   */
  getDefaultPort(): number;

  /**
   * Returns the name for the PersistentVolumeClaim and Volume.
   * This ensures naming consistency when mounting volumes.
   */
  getVolumeName(): string;

  /**
   * Generates the environment variables required for the main database container.
   * This is typically used to inject credentials from the generated Secret.
   * 
   * @param secretName - The name of the Kubernetes Secret containing 'username', 'password', etc.
   */
  createContainerEnv(secretName: string): V1EnvVar[];

  /**
   * Defines where the persistent volume should be mounted inside the container.
   */
  createVolumeMounts(): V1VolumeMount[];

  /**
   * Returns specific command-line arguments for the container entrypoint.
   * Useful for databases that need flags for configuration (like Redis passwords).
   */
  getContainerArgs(): string[];

  /**
   * Defines the Readiness Probe configuration.
   * This is critical to ensure traffic is only sent to healthy database instances.
   */
  getReadinessProbe(): V1Probe;

  /**
   * Generates the configuration for the automated backup CronJob.
   * If the database does not support automated backups yet, return null.
   * 
   * @param name - The name of the database resource
   * @param secretName - The name of the credentials secret
   * @param dbName - The internal database name
   * @param version - The database version (to choose the right tool image)
   */
  getBackupConfig(name: string, secretName: string, dbName: string, version: string): BackupConfig | null;

  /**
   * Normalizes the user-provided database name to be compatible with the database engine.
   * e.g. Postgres does not allow dashes in database names.
   */
  getInternalDbName(dbName: string): string;

  /**
   * Generates a suitable username for the database.
   * e.g. 'default' for Redis, or 'user_xxxx' for Postgres.
   */
  createUsername(): string;

  /**
   * Generates a secure password.
   */
  createPassword(): string;

  /**
   * Returns the shell command to dump the database to stdout.
   * Used for the "Ad-hoc Dump" feature in the UI.
   * The command runs inside the database pod.
   */
  createDumpCommand(): string[];

  /**
   * Returns the command to prepare the database for a restore (e.g. kill connections).
   */
  createPreRestoreCommand(): string[];

  /**
   * Returns the command to restore a dump from stdin.
   * The S3 stream will be piped into this command.
   */
  createRestoreCommand(): string[];
}
