import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('SPACES_BUCKET') || '';
    this.region = this.configService.get<string>('SPACES_REGION') || '';
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
}
