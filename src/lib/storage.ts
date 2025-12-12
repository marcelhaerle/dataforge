import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { config } from '@/lib/config';
import { Readable } from 'stream';

export interface BackupFile {
  key: string;
  filename: string;
  sizeMb: number;
  lastModified: Date;
}

class StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY,
        secretAccessKey: config.S3_SECRET_KEY,
      },
      forcePathStyle: true, // Important for MinIO!
    });
    this.bucket = config.S3_BUCKET;
  }

  /**
   * Lists all backups for a specific database.
   * Expects folder structure: s3://bucket/name/backup.sql
   */
  async listBackups(name: string): Promise<BackupFile[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${name}/`,
      });

      const response = await this.client.send(command);

      if (!response.Contents) return [];

      return response.Contents.map((item) => ({
        key: item.Key!,
        filename: item.Key!.split('/').pop() || 'unknown',
        sizeMb: Math.round(((item.Size || 0) / 1024 / 1024) * 100) / 100,
        lastModified: item.LastModified || new Date(),
      })).sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()); // Newest first
    } catch (error) {
      console.error(`S3 List Error for ${name}:`, error);
      return [];
    }
  }

  /**
   * Deletes all backups for a specific database (the entire "folder" in S3).
   */
  async deleteBackupsFolder(name: string) {
    try {
      // 1. First, list all objects in the folder
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${name}/`,
      });
      const listParams = await this.client.send(listCommand);

      if (!listParams.Contents || listParams.Contents.length === 0) {
        return; // Nothing to delete
      }

      // 2. Then delete them (Batch Delete)
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: listParams.Contents.map((item) => ({ Key: item.Key })),
          Quiet: true,
        },
      });

      await this.client.send(deleteCommand);
      console.log(`Deleted S3 backups for ${name}`);
    } catch (error) {
      console.error(`Failed to delete S3 backups for ${name}:`, error);
      // We do not throw an error here to prevent DB deletion from failing just because S3 is having issues
    }
  }

  /**
   * Prunes old backups for a specific database, keeping only the most recent ones.
   * Backups are sorted by last modified date (newest first), and only the newest
   * backups up to the `keep` limit are retained. All older backups are deleted.
   *
   * @param dbName - The name of the database whose backups should be pruned
   * @param keep - The number of most recent backups to keep (default: 5)
   * @returns The number of backups that were deleted
   * @throws {Error} If the deletion operation fails
   */
  async pruneBackups(dbName: string, keep: number = 5): Promise<number> {
    const backups = await this.listBackups(dbName);

    if (backups.length <= keep) {
      return 0; // Nothing to prune
    }

    // The list is already sorted (newest first).
    // We take everything from index 'keep' for deletion.
    const toDelete = backups.slice(keep);

    console.log(`Pruning ${toDelete.length} old backups for ${dbName}...`);

    try {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: toDelete.map((b) => ({ Key: b.key })),
          Quiet: true,
        },
      });

      await this.client.send(deleteCommand);
      return toDelete.length;
    } catch (e) {
      console.error('Prune failed:', e);
      throw new Error('Failed to prune backups');
    }
  }

  /**
   * Retrieves a backup file from S3 as a readable stream.
   *
   * @param key - The S3 object key of the backup file to retrieve
   * @returns A readable stream of the backup file contents
   * @throws {Error} If the backup file is empty or not found
   */
  async getBackupStream(key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('Backup file is empty or not found');
    }

    return response.Body as Readable;
  }
}

export const storageService = new StorageService();
