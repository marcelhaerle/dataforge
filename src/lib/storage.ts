import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { config } from '@/lib/config';

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

      return response.Contents
        .map(item => ({
          key: item.Key!,
          filename: item.Key!.split('/').pop() || 'unknown',
          sizeMb: Math.round((item.Size || 0) / 1024 / 1024 * 100) / 100,
          lastModified: item.LastModified || new Date(),
        }))
        .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()); // Newest first

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
          Objects: listParams.Contents.map(item => ({ Key: item.Key })),
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
}

export const storageService = new StorageService();
