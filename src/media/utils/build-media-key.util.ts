import { randomUUID } from 'crypto';

export function buildMediaKey(folder: string, originalName: string, fileName?: string): string {
  const fileExtension = originalName.split('.').pop();
  const uniqueFileName = fileName || randomUUID();

  return `${folder}/${uniqueFileName}.${fileExtension}`;
}
