import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly logger = new Logger(S3Service.name);
  private readonly cdnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('SPACES_BUCKET') || '';
    this.region = this.configService.get<string>('SPACES_REGION') || '';
    this.cdnUrl = this.configService.get<string>('CDN_URL') || '';
    const endpoint = this.configService.get<string>('SPACES_ENDPOINT');
    const accessKeyId = this.configService.get<string>('SPACES_KEY');
    const secretAccessKey = this.configService.get<string>('SPACES_SECRET');

    if (!this.bucketName || !this.region) {
      this.logger.error('S3 bucket name or region is not configured properly.');
    }

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3 credentials (endpoint, access key, or secret key) are not configured properly.',
      );
    }

    this.s3Client = new S3Client({
      forcePathStyle: false, // Configures to use subdomain format
      region: this.region,
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  }

  /**
   * Upload a file to DigitalOcean Spaces
   * Note: If the key is duplicated (already exists in the bucket), it'll overwrite the old one silently
   *
   * @param file - The file buffer to upload
   * @param folder - The folder path in Spaces (e.g., 'avatars', 'banners')
   * @param fileName - Optional custom filename (will generate UUID if not provided)
   * @param isPublic - Whether the file should be publicly accessible
   *
   * @returns Object containing the key and public URL of the uploaded file
   */
  async uploadFile({
    file,
    folder,
    fileName,
  }: {
    file: Express.Multer.File;
    folder: string;
    fileName?: string;
  }): Promise<{ key: string; url: string }> {
    try {
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = fileName || randomUUID();
      const key = `${folder}/${uniqueFileName}.${fileExtension}`;

      const uploadParams: PutObjectCommandInput = {
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Make file publicly readable
        ACL: 'public-read',
        // Cache control for 1 year
        CacheControl: 'public, max-age=31536000',
      };

      await this.s3Client.send(new PutObjectCommand(uploadParams));

      // Serve link to frontend
      const fileUrl = `${this.cdnUrl}/${key}`;

      this.logger.log(`File uploaded successfully to ${key}`);
      this.logger.log(`File URL: ${fileUrl}`);

      // Return the file URL
      return { key: key, url: fileUrl };
    } catch (error) {
      this.logger.error('File upload failed', error);
      throw error;
    }
  }

  /**
   * Delete a file from DigitalOcean Spaces
   *
   * @param key - The key of the file to delete
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully from ${key}`);
    } catch (error) {
      this.logger.error('File deletion failed', error);
      throw error;
    }
  }

  /**
   * Check if a file exists in Spaces
   *
   * @param key - The key of the file to check
   * @returns True if file exists, false otherwise
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: unknown) {
      this.logger.error('Error checking file existence in Spaces', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to check file existence: ${message}`);
    }
  }

  /**
   * Get the public URL for a file using CDN
   *
   * @param key - The key of the file
   * @returns Public URL via CDN
   */
  getPublicUrl(key: string): string {
    return `${this.cdnUrl}/${key}`;
  }
}
