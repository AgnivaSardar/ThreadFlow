import * as crypto from 'crypto';

export interface StorageAssetMetadata {
  storageKey: string;
  publicUrl: string;
  preSignedUploadUrl: string;
  sha256Checksum: string;
  fileSizeBytes: number;
  mimeType: string;
  blurhash: string;
}

export class SeedStorageHelper {
  private static readonly BUCKET_NAME = process.env.S3_BUCKET_NAME || 'threadflow-production-evidence';
  private static readonly CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://assets.threadflow.app';

  /**
   * Simulates generating a production-ready storage asset with SHA256 checksum,
   * blurhash placeholder, and S3 pre-signed upload URL.
   */
  static generateAssetMetadata(fileName: string, mimeType: string, seedEntropy: string): StorageAssetMetadata {
    const hash = crypto.createHash('sha256').update(`${fileName}-${seedEntropy}`).digest('hex');
    const storageKey = `orders/evidence/${hash.slice(0, 16)}/${fileName}`;
    const publicUrl = `${this.CDN_BASE_URL}/${storageKey}`;
    const preSignedUploadUrl = `https://${this.BUCKET_NAME}.s3.ap-south-1.amazonaws.com/${storageKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=${hash.slice(16, 48)}`;

    // Approximate realistic mobile camera photo sizes (350KB - 850KB)
    const fileSizeBytes = 350000 + (parseInt(hash.slice(0, 4), 16) % 500000);

    // Standard low-frequency blurhash representation
    const blurhash = `L6PZfSi_.AyE_3t7t7Rj~qofWBjt`;

    return {
      storageKey,
      publicUrl,
      preSignedUploadUrl,
      sha256Checksum: hash,
      fileSizeBytes,
      mimeType,
      blurhash,
    };
  }
}
