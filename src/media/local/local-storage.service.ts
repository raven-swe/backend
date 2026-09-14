import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants } from 'fs';
import { access, mkdir, rename, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import { randomUUID } from 'crypto';
import { MediaStorage, MediaStorageError, UploadFileParams } from '../storage';
import { buildMediaKey } from '../utils';

const DEFAULT_MEDIA_ROOT = './storage/media';

@Injectable()
export class LocalStorageService implements MediaStorage {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly mediaRoot: string;

  constructor(private readonly configService: ConfigService) {
    this.mediaRoot = resolve(this.configService.get<string>('MEDIA_ROOT') || DEFAULT_MEDIA_ROOT);

    this.logger.log(`Storing media under ${this.mediaRoot}`);
  }

  async uploadFile({ file, folder, fileName }: UploadFileParams): Promise<{ key: string }> {
    const key = buildMediaKey(folder, file.originalname, fileName);
    const destination = this.resolveKey(key);

    try {
      await mkdir(dirname(destination), { recursive: true });

      const temporaryPath = `${destination}.${randomUUID()}.tmp`;

      try {
        await writeFile(temporaryPath, file.buffer);
        await rename(temporaryPath, destination);
      } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
      }

      this.logger.log(`File written successfully to ${key}`);

      return { key };
    } catch (error) {
      this.logger.error('File write failed', error);
      throw new MediaStorageError(`Failed to write media ${key}`, error);
    }
  }

  async deleteFile(key: string): Promise<void> {
    const target = this.resolveKey(key);

    try {
      await unlink(target);
      this.logger.log(`File deleted successfully from ${key}`);
    } catch (error) {
      if (isNotFound(error)) {
        this.logger.warn(`File already absent, nothing to delete: ${key}`);
        return;
      }

      this.logger.error('File deletion failed', error);
      throw new MediaStorageError(`Failed to delete media ${key}`, error);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await access(this.resolveKey(key), constants.F_OK);
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;

      this.logger.error('Error checking file existence on disk', error);
      throw new MediaStorageError(`Failed to check media ${key}`, error);
    }
  }

  private resolveKey(key: string): string {
    const target = resolve(join(this.mediaRoot, key));

    if (target !== this.mediaRoot && !target.startsWith(this.mediaRoot + sep))
      throw new MediaStorageError(`Refusing to access media outside the root: ${key}`);

    return target;
  }
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
}
